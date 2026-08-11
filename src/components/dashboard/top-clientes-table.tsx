import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

type TopClientesTableProps = {
  data: { cliente_id: string; nombre: string; total_recargas: number }[];
};

/**
 * Top 10 clientes ranking by total recargas.
 * Server component rendering an accessible table.
 */
export function TopClientesTable({ data }: TopClientesTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 10 clientes</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
          Sin datos
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 clientes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-4">#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right pr-4">Recargas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={row.cliente_id}>
                <TableCell className="pl-4 font-medium text-muted-foreground">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clientes/${row.cliente_id}`}
                    className="text-primary hover:underline"
                  >
                    {row.nombre}
                  </Link>
                </TableCell>
                <TableCell className="text-right pr-4 tabular-nums font-medium">
                  {row.total_recargas}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
