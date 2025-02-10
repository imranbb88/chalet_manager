export interface Income {
  id: string;
  created_at: string;
  date: string;
  amount: number;
  description: string;
  category: string;
}

export interface Expense {
  id: string;
  created_at: string;
  date: string;
  amount: number;
  description: string;
  category: string;
}

export interface Database {
  public: {
    Tables: {
      income: {
        Row: Income;
        Insert: Omit<Income, 'id' | 'created_at'>;
        Update: Partial<Omit<Income, 'id' | 'created_at'>>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, 'id' | 'created_at'>;
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>;
      };
    };
  };
} 