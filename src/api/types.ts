export type BalanceItem = {
  asset: string;
  decimals: number;
  available: string;
  pending: string;
  claiming: string;
  usdPrice: string;
};

export type Balances = { asOf: string; items: BalanceItem[] };

export type ActivityItem = {
  id: string;
  type: 'accrual' | 'reversal' | 'claim';
  asset: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  exchange: string | null;
  createdAt: string;
  relatedId: string | null;
};

export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };

export type ClaimOptions = {
  asset: string;
  minAmount: string;
  fee: string;
  destinations: { id: string; label: string }[];
};

export type ClaimStatus = 'pending' | 'completed' | 'failed';

export type Claim = {
  id: string;
  asset: string;
  amount: string;
  fee: string;
  receiveAmount: string;
  destinationId: string;
  status: ClaimStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClaimBody = { asset: string; amount: string; destinationId: string };
