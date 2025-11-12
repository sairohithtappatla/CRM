import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

interface Payment {
  id: string;
  lead_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id: string | null;
  purpose: string | null;
  payer_phone: string | null;
  created_at: string;
}

interface PaymentTableProps {
  payments: Payment[];
}

const PaymentTable = ({ payments }: PaymentTableProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-status-admitted text-white";
      case "pending":
        return "bg-status-warm text-white";
      case "failed":
        return "bg-status-hot text-white";
      case "refunded":
        return "bg-status-cold text-white";
      default:
        return "bg-muted";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Payment ID</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length > 0 ? (
            payments.map((payment) => (
              <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="text-sm">
                  {formatDate(payment.created_at)}
                </TableCell>
                <TableCell className="text-sm">
                  {payment.purpose || 'N/A'}
                </TableCell>
                <TableCell className="text-sm font-mono text-xs">
                  {payment.payment_id || 'N/A'}
                </TableCell>
                <TableCell className="font-medium">
                  {formatAmount(payment.amount)}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(payment.status)}>
                    {payment.status.toUpperCase()}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No payments recorded yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PaymentTable;
