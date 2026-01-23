export interface QuestionCatalog {
  id: number;
  category: string | null;
  question_text: string;
  icon_name: string;
  target_column: string;
  options: {
    label: string;
    value: string;
  }[];
}
