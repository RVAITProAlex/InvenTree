import { Badge, Group } from '@mantine/core';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import type { TableColumn, InvenTreeTableProps } from '@lib/types/Tables';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo } from 'react';
import { InvenTreeTable } from '../../components/tables/InvenTreeTable';
import { StatusRenderer } from '../../components/render/StatusRenderer';
import { RenderStockLocation } from '../../components/render/Stock';

/**
 * Construct list of columns for Stock Item Table
 */
function stockItemColumns(): TableColumn[] {
  return [
    {
      accessor: 'part_detail.name',
      title: t`Inventory`,
      sortable: true,
      switchable: false,
      render: (record: any) =>
        record.part_detail?.full_name || record.part_detail?.name || '-'
    },
    {
      accessor: 'part_detail.IPN',
      title: 'IPN / SKU',
      sortable: true,
      render: (record: any) =>
        record.part_detail?.IPN || record.part_detail?.ipn || record.SKU || '-'
    },
    {
      accessor: 'part_detail.description',
      title: t`Description`,
      sortable: true,
      render: (record: any) =>
        record.part_detail?.description || record.notes || '-'
    },
    {
      accessor: 'tags',
      title: t`Tags`,
      sortable: false,
      switchable: true,
      render: (record: any) => {
        const rawTags = record?.tags || record?.part_detail?.tags;
        const tagList = Array.isArray(rawTags)
          ? rawTags.map(String)
          : typeof rawTags === 'string' && rawTags.trim()
          ? rawTags.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

        if (tagList.length === 0) return '-';

        return (
          <Group gap={4} wrap="wrap">
            {tagList.map((tag: string, index: number) => (
              <Badge key={`${tag}-${index}`} size="xs" variant="filled" color="blue">
                {tag}
              </Badge>
            ))}
          </Group>
        );
      }
    },
    {
      accessor: 'quantity',
      title: t`Stock`,
      sortable: true,
      render: (record: any) =>
        `${record.quantity} ${record.part_detail?.units || ''}`.trim()
    },
    {
      accessor: 'status',
      title: t`Status`,
      sortable: true,
      render: (record: any) => (
        <StatusRenderer
          status={record.status_custom_key || record.status}
          type={ModelType.stockitem}
        />
      )
    },
    {
      accessor: 'location_detail',
      title: t`Location`,
      sortable: true,
      render: (record: any) =>
        record.location_detail ? (
          <RenderStockLocation instance={record.location_detail} />
        ) : (
          '-'
        )
    },
    {
      accessor: 'stock_value',
      title: t`Stock Value`,
      sortable: true,
      render: (record: any) =>
        record.purchase_price
          ? `$${Number(record.purchase_price * record.quantity).toFixed(2)}`
          : '-'
    },
    {
      accessor: 'creation_date',
      title: t`Created`,
      sortable: true
    },
    {
      accessor: 'updated',
      title: t`Last Updated`,
      sortable: true
    }
  ];
}

export function StockItemTable({
  props,
  params,
  tableName = 'stock-item',
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
  const tableColumns = useMemo(() => stockItemColumns(), []);

  useEffect(() => {
    if (onSelectedRecordsChange && table.selectedRecords) {
      onSelectedRecordsChange(table.selectedRecords);
    }
  }, [table.selectedRecords, onSelectedRecordsChange]);

  return (
    <InvenTreeTable
      url={apiUrl(ApiEndpoints.stock_item_list)}
      tableState={table}
      columns={tableColumns}
      props={{
        ...props,
        modelType: ModelType.stockitem,
        enableSelection: enableSelection,
        params: {
          ...params,
          ...props?.params,
          part_detail: true,
          location_detail: true
        }
      }}
    />
  );
}