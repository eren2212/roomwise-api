import {
  Inject,
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Json } from '../database.types';
import {
  RekognitionClient,
  CompareFacesCommand,
  CompareFacesCommandOutput,
  DetectTextCommand,
} from '@aws-sdk/client-rekognition';
import { VerifyIdentityResponseDto } from './dto/identity.dto';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private readonly rekognitionClient: RekognitionClient;
  private readonly BUCKET_NAME = 'verification-docs';
  private readonly SIMILARITY_THRESHOLD = 90; // %90 benzerlik eşiği

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient<Database>,
  ) {
    // AWS Rekognition Client'ı başlat
    this.rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || 'eu-central-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.logger.log('AWS Rekognition Client başlatıldı');
  }

  /**
   * Ana kimlik doğrulama fonksiyonu
   * Selfie ve kimlik fotoğrafını alır, Supabase'e yükler, AWS ile karşılaştırır
   */
  async verifyUserIdentity(
    userId: string,
    selfieFile: Express.Multer.File,
    idPhotoFile: Express.Multer.File,
  ): Promise<VerifyIdentityResponseDto> {
    let selfiePath: string | null = null;
    let idPhotoPath: string | null = null;

    try {
      this.logger.log(`Kimlik doğrulama başlatıldı - User ID: ${userId}`);

      // 1. Dosya validasyonu
      this.validateFiles(selfieFile, idPhotoFile);

      // 2. Dosyaları Supabase'e yükle
      const uploadResult = await this.uploadFilesToSupabase(
        userId,
        selfieFile,
        idPhotoFile,
      );
      selfiePath = uploadResult.selfiePath;
      idPhotoPath = uploadResult.idPhotoPath;

      // 3. Dosyaları buffer olarak al
      const selfieBuffer = selfieFile.buffer;
      const idPhotoBuffer = idPhotoFile.buffer;

      // 4. Kimlik kartı kontrolü yap (ZORUNLU)
      this.logger.log('Kimlik kartı kontrolü başlatılıyor...');
      const isIDCard = await this.detectIDCard(idPhotoBuffer);

      if (!isIDCard) {
        this.logger.warn(
          `Kimlik kartı kontrolü başarısız - User ID: ${userId}`,
        );

        // Veritabanına rejected kaydı ekle
        await this.updateVerificationStatus(
          userId,
          'rejected',
          selfiePath,
          idPhotoPath,
          JSON.parse(
            JSON.stringify({ reason: 'ID card not detected' }),
          ) as Json,
        );

        return {
          success: false,
          message:
            'Yüklediğiniz fotoğraf geçerli bir TC Kimlik Kartı değil. Lütfen kimlik kartınızın ön yüzünü net bir şekilde çekin.',
          verificationStatus: 'rejected',
          confidence: 0,
        };
      }

      this.logger.log('Kimlik kartı kontrolü başarılı ✓');

      // 5. AWS Rekognition ile yüz karşılaştırması yap
      const comparisonResult = await this.compareFacesWithAWS(
        selfieBuffer,
        idPhotoBuffer,
      );

      // 6. Sonucu değerlendir ve veritabanını güncelle
      const response = await this.processComparisonResult(
        userId,
        comparisonResult,
        selfiePath,
        idPhotoPath,
      );

      this.logger.log(
        `Kimlik doğrulama tamamlandı - User ID: ${userId}, Durum: ${response.verificationStatus}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Kimlik doğrulama hatası - User ID: ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Kimlik doğrulama işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
      );
    } finally {
      // İşlem başarılı veya başarısız olsun, fotoğrafları sil
      if (selfiePath && idPhotoPath) {
        try {
          await this.deleteFilesFromSupabase(selfiePath, idPhotoPath);
          this.logger.log(
            `Storage temizlendi - User ID: ${userId} (Selfie: ${selfiePath}, ID: ${idPhotoPath})`,
          );
        } catch (deleteError) {
          // Silme hatası kritik değil, sadece logla
          this.logger.warn(
            `Storage temizleme hatası - User ID: ${userId}`,
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError),
          );
        }
      }
    }
  }

  /**
   * Dosya validasyonu - Boyut ve tip kontrolü
   */
  private validateFiles(
    selfieFile: Express.Multer.File,
    idPhotoFile: Express.Multer.File,
  ): void {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

    // Selfie kontrolü
    if (!selfieFile || !selfieFile.buffer) {
      throw new BadRequestException('Selfie fotoğrafı yüklenemedi');
    }

    if (selfieFile.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'Selfie fotoğrafı çok büyük (maksimum 10MB)',
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(selfieFile.mimetype)) {
      throw new BadRequestException(
        'Selfie fotoğrafı geçersiz format (sadece JPEG, JPG, PNG)',
      );
    }

    // Kimlik fotoğrafı kontrolü
    if (!idPhotoFile || !idPhotoFile.buffer) {
      throw new BadRequestException('Kimlik fotoğrafı yüklenemedi');
    }

    if (idPhotoFile.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'Kimlik fotoğrafı çok büyük (maksimum 10MB)',
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(idPhotoFile.mimetype)) {
      throw new BadRequestException(
        'Kimlik fotoğrafı geçersiz format (sadece JPEG, JPG, PNG)',
      );
    }
  }

  /**
   * Dosyaları Supabase Storage'a yükle
   */
  private async uploadFilesToSupabase(
    userId: string,
    selfieFile: Express.Multer.File,
    idPhotoFile: Express.Multer.File,
  ): Promise<{ selfiePath: string; idPhotoPath: string }> {
    const timestamp = Date.now();
    const selfieExt = selfieFile.originalname.split('.').pop() || 'jpg';
    const idPhotoExt = idPhotoFile.originalname.split('.').pop() || 'jpg';

    const selfiePath = `${userId}/selfie-${timestamp}.${selfieExt}`;
    const idPhotoPath = `${userId}/id-photo-${timestamp}.${idPhotoExt}`;

    try {
      // Selfie yükle
      const { error: selfieError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(selfiePath, selfieFile.buffer, {
          contentType: selfieFile.mimetype,
          upsert: false,
        });

      if (selfieError) {
        this.logger.error('Selfie yükleme hatası:', selfieError);
        throw new BadRequestException(
          `Selfie yüklenemedi: ${selfieError.message}`,
        );
      }

      // Kimlik fotoğrafı yükle
      const { error: idPhotoError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(idPhotoPath, idPhotoFile.buffer, {
          contentType: idPhotoFile.mimetype,
          upsert: false,
        });

      if (idPhotoError) {
        // Selfie'yi temizle
        await this.supabase.storage.from(this.BUCKET_NAME).remove([selfiePath]);
        this.logger.error('Kimlik fotoğrafı yükleme hatası:', idPhotoError);
        throw new BadRequestException(
          `Kimlik fotoğrafı yüklenemedi: ${idPhotoError.message}`,
        );
      }

      this.logger.log(`Dosyalar başarıyla yüklendi - User ID: ${userId}`);
      return { selfiePath, idPhotoPath };
    } catch (error) {
      this.logger.error('Supabase yükleme hatası:', error);
      throw error;
    }
  }

  /**
   * Storage'dan dosyaları sil (cleanup için)
   * Not: Veritabanındaki kayıtlar silinmez (audit trail için)
   */
  private async deleteFilesFromSupabase(
    selfiePath: string,
    idPhotoPath: string,
  ): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove([selfiePath, idPhotoPath]);

      if (error) {
        this.logger.error('Supabase dosya silme hatası:', error);
        throw new Error(`Dosyalar silinemedi: ${error.message}`);
      }

      this.logger.log(
        `Storage dosyaları silindi - Selfie: ${selfiePath}, ID: ${idPhotoPath}`,
      );
    } catch (error) {
      this.logger.error('Supabase dosya silme hatası:', error);
      throw error;
    }
  }
  /**
   * Kimlik kartı kontrolü - Text Detection ile
   * Fotoğrafta TC Kimlik Kartı'na ait kelimeler var mı kontrol eder
   */
  private async detectIDCard(idPhotoBuffer: Buffer): Promise<boolean> {
    try {
      const command = new DetectTextCommand({
        Image: { Bytes: idPhotoBuffer },
      });

      const response = await this.rekognitionClient.send(command);

      // TC Kimlik Kartı'nda olması gereken kelimeler
      const idKeywords = [
        'TÜRKİYE',
        'CUMHURİYETİ',
        'KİMLİK',
        'REPUBLIC',
        'TURKEY',
        'IDENTITY',
        'CARD',
        'TC', // TC Kimlik No için
      ];

      // Tespit edilen tüm metinleri al
      const detectedTexts =
        response.TextDetections?.map((detection) =>
          detection.DetectedText?.toUpperCase().trim(),
        ).filter(Boolean) || [];

      this.logger.log(
        `Tespit edilen metinler: ${detectedTexts.slice(0, 10).join(', ')}...`,
      );

      // En az 2 keyword varsa kimlik kartı kabul et
      // (Tek keyword yeterli olmayabilir, false positive önlemek için)
      const matchedKeywords = idKeywords.filter((keyword) =>
        detectedTexts.some((text) => text?.includes(keyword)),
      );

      const isIDCard = matchedKeywords.length >= 2;

      this.logger.log(
        `Kimlik kartı kontrolü: ${isIDCard ? 'BAŞARILI' : 'BAŞARISIZ'} - Eşleşen: ${matchedKeywords.join(', ')}`,
      );

      return isIDCard;
    } catch (error) {
      this.logger.error('Kimlik kartı text detection hatası:', error);

      // Text detection başarısız olursa güvenli tarafta kal
      if (error instanceof Error) {
        if (error.name === 'InvalidImageFormatException') {
          throw new BadRequestException(
            'Geçersiz fotoğraf formatı. Lütfen JPEG veya PNG kullanın.',
          );
        }
      }

      // Diğer hatalar için false döndür (kimlik kartı değil)
      return false;
    }
  }

  /**
   * AWS Rekognition ile yüz karşılaştırması
   */
  private async compareFacesWithAWS(
    selfieBuffer: Buffer,
    idPhotoBuffer: Buffer,
  ): Promise<CompareFacesCommandOutput> {
    try {
      const command = new CompareFacesCommand({
        SourceImage: { Bytes: idPhotoBuffer }, // Kaynak: Kimlik fotoğrafı
        TargetImage: { Bytes: selfieBuffer }, // Hedef: Selfie
        SimilarityThreshold: this.SIMILARITY_THRESHOLD,
        QualityFilter: 'AUTO', // Düşük kaliteli fotoğrafları filtrele
      });

      const response = await this.rekognitionClient.send(command);
      this.logger.log('AWS Rekognition yanıtı alındı');

      return response;
    } catch (error) {
      this.logger.error('AWS Rekognition hatası:', error);

      // AWS'den gelen özel hataları yakala
      if (error instanceof Error) {
        if (error.name === 'InvalidImageFormatException') {
          throw new BadRequestException(
            'Geçersiz fotoğraf formatı. Lütfen JPEG veya PNG kullanın.',
          );
        }

        if (error.name === 'ImageTooLargeException') {
          throw new BadRequestException('Fotoğraf çok büyük. Maksimum 15MB.');
        }

        if (error.name === 'InvalidParameterException') {
          throw new BadRequestException(
            'Fotoğraflarda yüz tespit edilemedi. Lütfen net bir fotoğraf yükleyin.',
          );
        }
      }

      throw new InternalServerErrorException(
        'Yüz karşılaştırma servisi şu anda kullanılamıyor.',
      );
    }
  }

  /**
   * Karşılaştırma sonucunu değerlendir ve veritabanını güncelle
   */
  private async processComparisonResult(
    userId: string,
    comparisonResult: CompareFacesCommandOutput,
    selfiePath: string,
    idPhotoPath: string,
  ): Promise<VerifyIdentityResponseDto> {
    const hasFaceMatches =
      comparisonResult.FaceMatches && comparisonResult.FaceMatches.length > 0;

    // AWS Rekognition data'yı hazırla ve Json type'ına cast et
    const rekognitionData = JSON.parse(
      JSON.stringify({
        faceMatches: comparisonResult.FaceMatches || [],
        unmatchedFaces: comparisonResult.UnmatchedFaces || [],
        sourceImageFace: comparisonResult.SourceImageFace || null,
        timestamp: new Date().toISOString(),
      }),
    ) as Json;

    if (!hasFaceMatches) {
      // Eşleşme yok - Reddedildi
      await this.updateVerificationStatus(
        userId,
        'rejected',
        selfiePath,
        idPhotoPath,
        rekognitionData,
      );

      return {
        success: false,
        message:
          'Kimlik doğrulaması başarısız. Yüzler eşleşmedi veya fotoğraflar net değil.',
        confidence: 0,
        verificationStatus: 'rejected',
        details: {
          faceMatches: 0,
          similarity: 0,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Eşleşme var - Başarılı
    const similarity = comparisonResult.FaceMatches![0].Similarity!;
    await this.updateVerificationStatus(
      userId,
      'verified',
      selfiePath,
      idPhotoPath,
      rekognitionData,
    );

    return {
      success: true,
      message: 'Kimlik başarıyla doğrulandı!',
      confidence: similarity,
      verificationStatus: 'verified',
      details: {
        faceMatches: comparisonResult.FaceMatches!.length,
        similarity: similarity,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Veritabanında verification durumunu güncelle
   * 1. identity_verifications tablosuna kayıt ekler/günceller
   * 2. profiles tablosunda is_verified ve verification_status günceller
   */
  private async updateVerificationStatus(
    userId: string,
    status: 'verified' | 'rejected' | 'pending',
    selfiePath: string | null,
    idPhotoPath: string | null,
    rekognitionData?: Json,
  ): Promise<void> {
    try {
      // 1. identity_verifications tablosuna kayıt ekle
      if (selfiePath && idPhotoPath) {
        const { error: identityError } = await this.supabase
          .from('identity_verifications')
          .insert({
            user_id: userId,
            selfie_url: selfiePath,
            id_photo_url: idPhotoPath,
            status: status,
            rekognition_data: rekognitionData || null,
          });

        if (identityError) {
          this.logger.error(
            `identity_verifications tablosuna ekleme hatası - User ID: ${userId}`,
            identityError,
          );
          // Bu hata kritik değil, devam edebiliriz
        }
      }

      // 2. profiles tablosunu güncelle
      const updateData = {
        verification_status: status,
        updated_at: new Date().toISOString(),
        is_verified: status === 'verified',
      };

      const { error: profileError } = await this.supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (profileError) {
        this.logger.error(
          `profiles tablosu güncelleme hatası - User ID: ${userId}`,
          profileError,
        );
        throw new InternalServerErrorException(
          'Doğrulama durumu güncellenemedi',
        );
      }

      this.logger.log(
        `Verification durumu güncellendi - User ID: ${userId}, Durum: ${status}`,
      );
    } catch (error) {
      this.logger.error('updateVerificationStatus hatası:', error);
      throw error;
    }
  }

  /**
   * Kullanıcının doğrulama durumunu getir
   */
  async getVerificationStatus(userId: string): Promise<{
    isVerified: boolean;
    verificationStatus: string;
    verifiedAt?: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('is_verified, verification_status, updated_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }

    return {
      isVerified: data.is_verified ?? false,
      verificationStatus: data.verification_status ?? 'pending',
      verifiedAt: data.updated_at,
    };
  }
}
