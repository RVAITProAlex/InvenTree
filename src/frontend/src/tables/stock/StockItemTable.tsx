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
 * Universal tag extractor checking all potential API property locations
 */
function extractTags(record: any): string[] {
  const possibleSources = [
    record?.tags,
    record?.tag_list,
    record?.tags_detail,
    record?.part_detail?.tags,
    record?.part_detail?.tag_list
  ];

  const foundTags: string[] = [];

  for (const source of possibleSources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      source.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          foundTags.push(item.trim());
        } else if (typeof item === 'object' && item !== null) {
          const val = item.name || item.label || item.tag || item.slug;
          if (val) foundTags.push(String(val).trim());
        }
      });
    } else if (typeof source === 'string' && source.trim()) {
      source.split(',').forEach((s) => {
        if (s.trim()) foundTags.push(s.trim());
      });
    }
  }

  // Deduplicate array
  return Array.from(new Set(foundTags));
}

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
      title: t`IPN / SKU`,
      sortable: true,
      render: (record: any) =>
        record.part_detail?.IPN || record.part_detail?.ipn || record.SKU || '-'
    },
    {
      accessor: 'part_detail.description',
      title: t`Description`,
      sortable: true,
      render: (record: any) =>
        record.part_detail?.description || record.notes || record.purchase_order_reference || '-'
    },
    {
      accessor: 'tags',
      title: t`Tags`,
      sortable: false,
      switchable: true,
      render: (record: any) => {
        // Collect tags or fallback identifiers (like SKU / PO reference)
        const rawTags = record?.tags || record?.part_detail?.tags;
        let tagList: string[] = [];

        if (Array.isArray(rawTags)) {
          tagList = rawTags.map((t) => String(t)).filter(Boolean);
        } else if (typeof rawTags === 'string' && rawTags.trim()) {
          tagList = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
        }

        // If no explicit tags exist in payload, fallback to purchase order or status tag
        if (tagList.length === 0 && record.purchase_order_reference) {
          tagList = [record.purchase_order_reference];
        }

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

  // Broadcast row selections if used in parent modals
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