import {
  Badge,
  Grid,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  Title
} from '@mantine/core';
import {
  IconCalendar,
  IconChecklist,
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

  const projectTitle =
    instance?.description ||
    instance?.title ||
    instance?.notes ||
    'Project Details';

  const projectScope =
    instance?.description ||
    instance?.title ||
    instance?.notes ||
    'No description provided.';

  // Helper renderer for person / user details
  const renderPerson = (detail: any, rawValue: any) => {
    if (detail) {
      if (typeof detail === 'object') {
        if (detail.username || detail.first_name || detail.last_name) {
          return <RenderUser user={detail} />;
        }
        if (detail.name || detail.label) {
          return <Badge color='blue'>{detail.label || detail.name}</Badge>;
        }
      }
      return <Badge color='blue'>{String(detail)}</Badge>;
    }
    if (rawValue) {
      return <Badge color='gray'>{String(rawValue)}</Badge>;
    }
    return <Text size='sm'>-</Text>;
  };

  // Helper renderer for staging location
  const renderLocation = (detail: any, rawValue: any) => {
    if (detail && typeof detail === 'object' && detail.pk) {
      return <RenderStockLocation instance={detail} />;
    }
    if (detail?.name || detail?.pathstring) {
      return <Text size='sm'>{detail.pathstring || detail.name}</Text>;
    }
    if (rawValue) {
      return <Text size='sm'>Location #{String(rawValue)}</Text>;
    }
    return <Text size='sm'>-</Text>;
  };

  return (
    <Grid p='xs' gutter='md'>
      {/* Box 1: Project Identity & Scope */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p='md' withBorder radius='md' h='100%'>
          <Stack gap='xs'>
            <Group justify='space-between'>
              <Title order={4}>{projectTitle}</Title>
              <StatusRenderer
                status={instance?.status_custom_key || instance?.status}
                type={ModelType.build}
              />
            </Group>

            <Group gap='xs' mt='xs'>
              <Text fw={500} size='sm' c='dimmed'>Project Reference:</Text>
              <Badge variant='outline' color='blue'>{instance?.reference}</Badge>
            </Group>

            {clientTag && (
              <Group gap='xs'>
                <Text fw={500} size='sm' c='dimmed'>Client / Account:</Text>
                <Badge color='violet'>{clientTag}</Badge>
              </Group>
            )}

            <Stack gap={2} mt='xs'>
              <Text fw={500} size='sm' c='dimmed'>Project Purpose / Scope:</Text>
              <Text size='sm'>{projectScope}</Text>
            </Stack>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Box 2: Inventory & Material Readiness */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p='md' withBorder radius='md' h='100%'>
          <Stack gap='xs'>
            <Group gap='xs'>
              <IconChecklist size={20} color='gray' />
              <Title order={5}>Material Readiness</Title>
            </Group>

            <Group justify='space-between' mt='xs'>
              <Text size='sm'>Total Required Line Items:</Text>
              <Text fw={700} size='sm'>{materialMetrics.totalItems} items</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm'>Items Fully In Stock:</Text>
              <Text fw={700} size='sm' c={materialMetrics.percentReady === 100 ? 'green' : 'orange'}>
                {materialMetrics.itemsInStock} / {materialMetrics.totalItems} ({materialMetrics.percentReady}%)
              </Text>
            </Group>

            <Stack gap={4} mt='xs'>
              <Text size='xs' c='dimmed'>Overall Stock Readiness</Text>
              <Progress
                value={materialMetrics.percentReady}
                color={materialMetrics.percentReady === 100 ? 'green' : 'blue'}
                size='md'
                radius='xl'
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
              <Text fw={600} size='sm'>Team & Locations</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>Project Lead:</Text>
              {renderPerson(instance?.responsible_detail, instance?.responsible)}
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>Created By:</Text>
              {renderPerson(instance?.issued_by_detail, instance?.issued_by)}
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>Staging Location:</Text>
              {renderLocation(instance?.take_from_detail, instance?.take_from)}
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
              <Text fw={600} size='sm'>Project Timeline</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>Date Created:</Text>
              <Text size='sm'>{instance?.creation_date || '-'}</Text>
            </Group>

            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>Target Completion:</Text>
              <Text size='sm' fw={500}>
                {instance?.target_date || 'No target date set'}
              </Text>
            </Group>
          </Stack>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}