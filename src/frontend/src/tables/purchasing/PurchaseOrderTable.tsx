import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import type { TableColumn, InvenTreeTableProps } from '@lib/types/Tables';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo } from 'react';
import { InvenTreeTable } from '../../components/tables/InvenTreeTable';

/**
 * Construct list of columns for Purchase Order Table
 */
function purchaseOrderColumns(): TableColumn[] {
  return [
    {
      accessor: 'reference',
      title: t`Reference`,
      sortable: true,
      switchable: false
    },
    {
      accessor: 'description',
      title: t`Description`,
      sortable: true
    },
    {
      accessor: 'supplier_detail.name',
      title: t`Supplier`,
      sortable: true
    },
    {
      accessor: 'supplier_reference',
      title: t`Supplier Reference`,
      sortable: true
    },
    {
      accessor: 'project_code',
      title: t`Project Code`,
      sortable: true
    },
    {
      accessor: 'line_items',
      title: t`Line Items`,
      sortable: true
    },
    {
      accessor: 'status',
      title: t`Order Status`,
      sortable: true
    },
    {
      accessor: 'target_date',
      title: t`Target Date`,
      sortable: true
    },
    {
      accessor: 'completion_date',
      title: t`Completion Date`,
      sortable: true
    },
    {
      accessor: 'total_price',
      title: t`Total Price`,
      sortable: true
    }
  ];
}

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
  const tableColumns = useMemo(() => purchaseOrderColumns(), []);

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
      columns={tableColumns}
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