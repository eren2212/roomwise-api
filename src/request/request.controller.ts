import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RequestService } from './request.service';
import { SupabaseGuard } from '../auth/supabase.guard';
import type { RequestWithUser } from '../auth/supabase.guard';
import { CreateRequestDto, UpdateRequestStatusDto } from './dto';

@Controller('request')
@UseGuards(SupabaseGuard)
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  /**
   * Yeni ev isteği gönder
   * POST /request
   */
  @Post()
  async createRequest(
    @Request() req: RequestWithUser,
    @Body() createRequestDto: CreateRequestDto,
  ) {
    const userId = req.user!.id;
    const request = await this.requestService.createRequest(
      userId,
      createRequestDto,
    );

    return {
      success: true,
      message: 'İstek başarıyla gönderildi',
      data: request,
    };
  }

  /**
   * Eve gelen istekleri getir
   * GET /request/house/:houseId
   */
  @Get('house/:houseId')
  async getRequestsForHouse(
    @Request() req: RequestWithUser,
    @Param('houseId') houseId: string,
  ) {
    const userId = req.user!.id;
    const requests = await this.requestService.getRequestsForHouse(
      userId,
      houseId,
    );

    return {
      success: true,
      data: requests,
    };
  }

  /**
   * Bekleyen istek sayısını getir
   * GET /request/pending-count
   */
  @Get('pending-count')
  async getPendingRequestCount(@Request() req: RequestWithUser) {
    const userId = req.user!.id;
    const count = await this.requestService.getPendingRequestCount(userId);

    return {
      success: true,
      data: { count },
    };
  }

  /**
   * İstek detayını getir
   * GET /request/:id
   */
  @Get(':id')
  async getRequestById(
    @Request() req: RequestWithUser,
    @Param('id') requestId: string,
  ) {
    const userId = req.user!.id;
    const request = await this.requestService.getRequestById(userId, requestId);

    return {
      success: true,
      data: request,
    };
  }

  /**
   * İstek durumunu güncelle (kabul/red)
   * PATCH /request/:id/status
   */
  @Patch(':id/status')
  async updateRequestStatus(
    @Request() req: RequestWithUser,
    @Param('id') requestId: string,
    @Body() updateDto: UpdateRequestStatusDto,
  ) {
    const userId = req.user!.id;
    const request = await this.requestService.updateRequestStatus(
      userId,
      requestId,
      updateDto,
    );

    return {
      success: true,
      message:
        updateDto.status === 'verified'
          ? 'İstek kabul edildi'
          : 'İstek reddedildi',
      data: request,
    };
  }
}
