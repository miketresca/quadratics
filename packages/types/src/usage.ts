export interface CreditBalance {
  balance: number;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  creditBalance: number;
}
