import { t } from '@lingui/core/macro';
import {
  Badge,
  Grid,
  Group,
  Paper,
  ProgressBar,
  Stack,
  Text,
  Title
} from '@mantine/core';
import {
  IconBoxes,
  IconCalendar,
  IconChecklist,
  IconInfoCircle,
  IconMapPin,
  IconUser
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { RenderStockLocation } from '../../components/render/Stock';
import { StatusRenderer } from '../../components/render/StatusRenderer';
import { RenderUser } from '../../components/render/User';
import { useInstance } from '../../hooks/UseInstance';

export function BuildOrderDetailsPanel({
  instance,
  refreshInstance
}: Readonly<{
  instance: any;
  refreshInstance?: () => void;
}>) {
  // Fetch required build lines to calculate stock readiness
  const { instance: lineData } = useInstance({
    endpoint: ApiEndpoints.build_line_list,
    params: {
      build: instance?.pk,
      part_detail: true,
      bom_item_detail: true
    },
    disabled: !instance?.pk,
    hasPrimaryKey: false,
    defaultValue: []
  });

  // Calculate material readiness metrics
  const materialMetrics = useMemo(() => {
    const lines = Array.isArray(lineData) ? lineData : lineData?.results || [];
    const totalItems = lines.length;

    let itemsInStock = 0;
    lines.forEach((line: any) => {
      const available = line.available_stock ?? 0;
      const required = line.quantity ?? 1;
      if (available >= required) {
        itemsInStock += 1;
      }
    });

    const percentReady = totalItems > 0 ? Math.round((itemsInStock / totalItems) * 100) : 0;

    return {
      totalItems,
      itemsInStock,
      percentReady
    };
  }, [lineData]);

  const clientTag = useMemo(() => {
    if (Array.isArray(instance?.tags) && instance.tags.length > 0) {
      return instance.tags[0];
    }
    return null;
  }, [instance]);

  return (
    <Grid p='xs' gutter='md'>
      {/* Box 1: Project Identity & Scope */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p='md' withBorder radius='md' h='100%'>
          <Stack gap='xs'>
            <Group justify='space-between'>
              <Title order={4}>{instance.description || t`Project Details`}</Title>
              <StatusRenderer
                status={instance.status_custom_key || instance.status}
                type={ModelType.build}
              />
            </Group>

            <Group gap='xs' mt='xs'>
              <Text fw={500} size='sm' c='dimmed'>{t`Project Reference`}:</Text>
              <Badge variant='outline' color='blue'>{instance.reference}</Badge>
            </Group>

            {clientTag && (
              <Group gap='xs'>
                <Text fw={500} size='sm' c='dimmed'>{t`Client / Account`}:</Text>
                <Badge color='violet'>{clientTag}</Badge>
              </Group>
            )}

            <Stack gap={2} mt='xs'>
              <Text fw={500} size='sm' c='dimmed'>{t`Project Purpose / Scope`}:</Text>
              <Text size='sm'>{instance.description || t`No description provided.`}</Text>
            </Stack>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Box 2: Inventory & Material Readiness */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p='md' withBorder radius='md' h='100%'>
          <Stack gap='xs'>
            <Group gap='xs'>
              <IconBoxes size={20} color='gray' />
              <Title order={5}>{t`Material Readiness`}</Title>
            </Group>

            <Group justify='space-between' mt='xs'>
              <Text size='sm'>{t`Total Required Line Items`}:</Text>
              <Text fw={700} size='sm'>{materialMetrics.totalItems} {t`items`}</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm'>{t`Items Fully In Stock`}:</Text>
              <Text fw={700} size='sm' c={materialMetrics.percentReady === 100 ? 'green' : 'orange'}>
                {materialMetrics.itemsInStock} / {materialMetrics.totalItems} ({materialMetrics.percentReady}%)
              </Text>
            </Group>

            <Stack gap={4} mt='xs'>
              <Text size='xs' c='dimmed'>{t`Overall Stock Readiness`}</Text>
              <ProgressBar
                value={materialMetrics.percentReady}
                color={materialMetrics.percentReady === 100 ? 'green' : 'blue'}
              />
            </Stack>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Box 3: Team & Location */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p='md' withBorder radius='md'>
          <Stack gap='xs'>
            <Group gap='xs'>
              <IconUser size={18} />
              <Text fw={600} size='sm'>{t`Team & Locations`}</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>{t`Project Lead`}:</Text>
              {instance.responsible_detail ? (
                <RenderUser user={instance.responsible_detail} />
              ) : (
                <Text size='sm'>-</Text>
              )}
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>{t`Created By`}:</Text>
              {instance.issued_by_detail ? (
                <RenderUser user={instance.issued_by_detail} />
              ) : (
                <Text size='sm'>-</Text>
              )}
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>{t`Staging Location`}:</Text>
              {instance.take_from_detail ? (
                <RenderStockLocation instance={instance.take_from_detail} />
              ) : (
                <Text size='sm'>-</Text>
              )}
            </Group>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Box 4: Dates & Timeline */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p='md' withBorder radius='md'>
          <Stack gap='xs'>
            <Group gap='xs'>
              <IconCalendar size={18} />
              <Text fw={600} size='sm'>{t`Project Timeline`}</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>{t`Date Created`}:</Text>
              <Text size='sm'>{instance.creation_date || '-'}</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>{t`Target Completion`}:</Text>
              <Text size='sm' fw={500}>
                {instance.target_date || t`No target date set`}
              </Text>
            </Group>
          </Stack>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}