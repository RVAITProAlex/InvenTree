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
 * Universal tag parser that extracts all tags from strings, arrays, or objects
 */
function parseTags(tagInput: any): string[] {
  if (!tagInput) return [];

  // Handle stringified JSON arrays
  if (typeof tagInput === 'string') {
    const trimmed = tagInput.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        tagInput = JSON.parse(trimmed);
      } catch {
        // Fall back to standard string splitting below
      }
    }
  }

  // Handle arrays of strings or objects
  if (Array.isArray(tagInput)) {
    return tagInput
      .flatMap((item) => {
        if (typeof item === 'string') {
          return item.split(/[,|]/).map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
        }
        if (typeof item === 'object' && item !== null) {
          const val = item.name || item.label || item.tag || item.value || item.slug || '';
          return [String(val).trim()];
        }
        return [String(item).trim()];
      })
      .filter(Boolean);
  }

  // Handle comma or pipe separated strings
  if (typeof tagInput === 'string') {
    return tagInput
      .split(/[,|]/)
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  // Handle single object representations
  if (typeof tagInput === 'object' && tagInput !== null) {
    const name = tagInput.name || tagInput.label || tagInput.tag || tagInput.value || tagInput.slug;
    if (name) return [String(name).trim()];
  }

  return [];
}

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
      title: t`IPN`,
      sortable: true,
      render: (record: any) => record.part_detail?.IPN || '-'
    },
    {
      accessor: 'part_detail.description',
      title: t`Description`,
      sortable: true,
      render: (record: any) => record.part_detail?.description || '-'
    },
    {
      accessor: 'tags',
      title: t`Tags`,
      sortable: false,
      switchable: true,
      render: (record: any) => {
        const itemTags = parseTags(
          record?.tags ?? record?.tag_list ?? record?.tags_detail ?? record?.keywords
        );
        const partTags = parseTags(
          record?.part_detail?.tags ??
            record?.part_detail?.tag_list ??
            record?.part_detail?.keywords
        );

        // Deduplicate tags
        const allTags = Array.from(new Set([...itemTags, ...partTags]));

        if (allTags.length === 0) return '-';

        return (
          <Group gap={4} wrap="wrap">
            {allTags.map((tag: string) => (
              <Badge key={tag} size="xs" variant="filled" color="blue">
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
      accessor: 'batch',
      title: t`Batch Code`,
      sortable: true,
      render: (record: any) => record.batch || '-'
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
    },
    {
      accessor: 'stocktake_date',
      title: t`Stocktake Date`,
      sortable: true,
      render: (record: any) => record.stocktake_date || '-'
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

  // Broadcast row selections if used in modals
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