export type OperatorID = 'Zâne Bune' | 'The Sailor';

export type VoucherStatus = 'Nefolosit' | 'Parțial' | 'Folosit';

export interface Voucher {
  id: string;
  qr_code_url: string;
  scans_op1: number;
  scans_op2: number;
  status: VoucherStatus;
  last_scan: string | null;
}

export type View = 'SELECT_OPERATOR' | 'OPERATOR_HUB' | 'SCANNER' | 'VOUCHER_LIST' | 'QR_GENERATOR' | 'PRINT_PREVIEW' | 'SCAN_RESULT';