import { useEffect } from 'react';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import type { InvenTreeTableProps } from '@lib/types/Tables';
import { InvenTreeTable } from '../../components/tables/InvenTreeTable';

export function PurchaseOrderTable({
  props,
  params,
  tableName = 'purchase-order',
  enableSelection = false,
  selectedRecords,
  onSelectedRecordsChange
}: {
  props?: InvenTreeTableProps;
  params?: any;
  tableName?: string;
  enableSelection?: boolean;
  selectedRecords?: any[];
  onSelectedRecordsChange?: (records: any[]) => void;
}) {
  const table = useTable(tableName);

  // Broadcast row checkbox clicks back up to parent components / modals
  useEffect(() => {
    if (onSelectedRecordsChange && table.selectedRecords) {
      onSelectedRecordsChange(table.selectedRecords);
    }
  }, [table.selectedRecords, onSelectedRecordsChange]);

  return (
    <InvenTreeTable
      url={apiUrl(ApiEndpoints.purchase_order_list)}
      tableState={table}
      props={{
        ...props,
        modelType: ModelType.purchaseorder,
        enableSelection: enableSelection,
        params: {
          ...params,
          ...props?.params,
          supplier_detail: true
        }
      }}
    />
  );
}