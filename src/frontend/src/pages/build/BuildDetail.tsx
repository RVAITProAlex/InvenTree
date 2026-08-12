import { t } from '@lingui/core/macro';
import {
  Alert,
  Button,
  Group,
  Modal,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChecklist,
  IconCircleCheck,
  IconClipboardCheck,
  IconClipboardList,
  IconExclamationCircle,
  IconInfoCircle,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconPaperclip,
  IconPlus,
  IconShoppingCart,
  IconSitemap
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { getDetailUrl } from '@lib/functions/Navigation';
import type { ApiFormFieldSet } from '@lib/types/Forms';
import type { PanelType } from '@lib/types/Panel';
import AdminButton from '../../components/buttons/AdminButton';
import PrimaryActionButton from '../../components/buttons/PrimaryActionButton';
import { PrintingActions } from '../../components/buttons/PrintingActions';
import DetailsBadge from '../../components/details/DetailsBadge';
import {
  BarcodeActionDropdown,
  CancelItemAction,
  DuplicateItemAction,
  EditItemAction,
  HoldItemAction,
  OptionsActionDropdown
} from '../../components/items/ActionDropdown';
import InstanceDetail from '../../components/nav/InstanceDetail';
import { PageDetail } from '../../components/nav/PageDetail';
import AttachmentPanel from '../../components/panels/AttachmentPanel';
import NotesPanel from '../../components/panels/NotesPanel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import ParametersPanel from '../../components/panels/ParametersPanel';
import { StatusRenderer } from '../../components/render/StatusRenderer';
import { RenderStockLocation } from '../../components/render/Stock';
import { useApi } from '../../contexts/ApiContext';
import { useBuildOrderFields } from '../../forms/BuildForms';
import {
  useCreateApiFormModal,
  useEditApiFormModal
} from '../../hooks/UseForm';
import { useInstance } from '../../hooks/UseInstance';
import useStatusCodes from '../../hooks/UseStatusCodes';
import { useGlobalSettingsState } from '../../states/SettingsStates';
import { useUserState } from '../../states/UserState';
import BuildAllocatedStockTable from '../../tables/build/BuildAllocatedStockTable';
import BuildLineTable from '../../tables/build/BuildLineTable';
import { BuildOrderTable } from '../../tables/build/BuildOrderTable';
import BuildOutputTable from '../../tables/build/BuildOutputTable';
import { PartListTable } from '../../tables/part/PartTable';
import PartTestResultTable from '../../tables/part/PartTestResultTable';
import { PurchaseOrderTable } from '../../tables/purchasing/PurchaseOrderTable';
import { StockItemTable } from '../../tables/stock/StockItemTable';
import { BuildOrderDetailsPanel } from './BuildOrderDetailsPanel';

function NoItems() {
  return (
    <Alert color='blue' icon={<IconInfoCircle />} title={t`No Required Items`}>
      <Stack gap='xs'>
        <Text>{t`This build order does not have any required items.`}</Text>
        <Text>{t`The assembled part may not have a Bill of Materials (BOM) defined, or the BOM is empty.`}</Text>
      </Stack>
    </Alert>
  );
}

/**
 * Panel to display the lines of a build order
 */
function BuildLinesPanel({
  build,
  isLoading,
  hasItems
}: Readonly<{
  build: any;
  isLoading: boolean;
  hasItems: boolean;
}>) {
  const bomInformation = useInstance({
    endpoint: ApiEndpoints.bom_validate,
    pk: build?.part,
    hasPrimaryKey: true,
    refetchOnMount: true
  });

  const buildLocation = useInstance({
    endpoint: ApiEndpoints.stock_location_list,
    pk: build?.take_from,
    hasPrimaryKey: true,
    defaultValue: {}
  });

  if (isLoading || !build.pk) {
    return <Skeleton w={'100%'} h={400} animate />;
  }

  return (
    <Stack gap='xs'>
      {bomInformation?.isLoaded &&
        bomInformation?.instance?.bom_validated == false && (
          <Alert
            color='orange'
            icon={<IconExclamationCircle />}
            title={t`BOM Not Validated`}
          >
            <Text>{t`The Bill of Materials for this assembly has not been validated.`}</Text>
          </Alert>
        )}
      {buildLocation.instance.pk && (
        <Alert color='blue' icon={<IconSitemap />} title={t`Source Location`}>
          <RenderStockLocation instance={buildLocation.instance} />
        </Alert>
      )}
      <BuildLineTable build={build} />
    </Stack>
  );
}

function BuildAllocationsPanel({
  build,
  isLoading,
  hasItems
}: Readonly<{
  build: any;
  isLoading: boolean;
  hasItems: boolean;
}>) {
  if (isLoading || !build.pk) {
    return <Skeleton w={'100%'} h={400} animate />;
  }

  if (!hasItems) {
    return <NoItems />;
  }

  return <BuildAllocatedStockTable buildId={build.pk} showPartInfo allowEdit />;
}

/**
 * Detail page for a single Build Order
 */
export default function BuildDetail() {
  const { id } = useParams();
  const api = useApi();

  const user = useUserState();
  const globalSettings = useGlobalSettingsState();

  // Modal open/close state for catalog multi-selection
  const [catalogModalOpened, { open: openCatalogModal, close: closeCatalogModal }] =
    useDisclosure(false);
  const [selectedPartIds, setSelectedPartIds] = useState<number[]>([]);
  const [isSubmittingParts, setIsSubmittingParts] = useState(false);

  // Fetch the number of BOM items associated with the build order
  const { instance: buildLineData, instanceQuery: buildLineQuery } =
    useInstance({
      endpoint: ApiEndpoints.build_line_list,
      params: {
        build: id,
        allocations: false,
        part_detail: false,
        build_detail: false,
        bom_item_detail: false,
        limit: 1
      },
      disabled: !id,
      hasPrimaryKey: false,
      defaultValue: {}
    });

  // Fetch the number of assembled BOM items associated with the build order
  const { instance: subassemblyLineData } = useInstance({
    endpoint: ApiEndpoints.build_line_list,
    params: {
      build: id,
      allocations: false,
      part_detail: false,
      build_detail: false,
      bom_item_detail: false,
      assembly: true,
      limit: 1
    },
    disabled: !id,
    hasPrimaryKey: false,
    defaultValue: {}
  });

  // Fetch the number of child build orders associated with this build order
  const { instance: childBuildData } = useInstance({
    endpoint: ApiEndpoints.build_order_list,
    params: {
      parent: id,
      limit: 1
    },
    disabled: !id,
    hasPrimaryKey: false,
    defaultValue: {}
  });

  const showChildBuilds = useMemo(() => {
    return childBuildData?.count > 0 || subassemblyLineData?.count > 0;
  }, [childBuildData, subassemblyLineData]);

  const buildStatus = useStatusCodes({ modelType: ModelType.build });

  const {
    instance: build,
    refreshInstance,
    instanceQuery
  } = useInstance({
    endpoint: ApiEndpoints.build_order_list,
    pk: id,
    params: {
      part_detail: true,
      tags: true
    },
    hasPrimaryKey: true,
    defaultValue: {},
    refetchOnMount: true
  });

  // Batch-add selected catalog parts to project build lines
  const handleAddSelectedParts = async () => {
    if (selectedPartIds.length === 0) return;
    setIsSubmittingParts(true);

    try {
      await Promise.all(
        selectedPartIds.map((partId) =>
          api.post(ApiEndpoints.build_line_list, {
            build: id,
            part: partId,
            quantity: 1
          })
        )
      );

      setSelectedPartIds([]);
      closeCatalogModal();
      buildLineQuery.refetch();
      refreshInstance();
    } catch (err) {
      console.error('Failed to add parts to project:', err);
    } finally {
      setIsSubmittingParts(false);
    }
  };

  const buildPanels: PanelType[] = useMemo(() => {
    return [
      {
        name: 'details',
        label: t`Project Info`,
        icon: <IconInfoCircle />,
        content: (
          <BuildOrderDetailsPanel
            instance={build}
            allowImageEdit
            refreshInstance={refreshInstance}
          />
        )
      },
      {
        name: 'line-items',
        label: t`Required Parts`,
        icon: <IconListNumbers />,
        content: (
          <Stack gap='md'>
            <Group justify='space-between'>
              <Title order={4}>{t`Required Parts`}</Title>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openCatalogModal}
              >
                {t`Add Required Parts`}
              </Button>
            </Group>
            <BuildLinesPanel
              build={build}
              isLoading={buildLineQuery.isFetching || buildLineQuery.isLoading}
              hasItems={buildLineData?.count > 0}
            />
          </Stack>
        )
      },
      {
        name: 'purchase-orders',
        label: t`Purchase Orders`,
        icon: <IconShoppingCart />,
        content: build.pk ? (
          <PurchaseOrderTable externalBuildId={build.pk} />
        ) : (
          <Skeleton />
        )
      },
      AttachmentPanel({
        model_type: ModelType.build,
        model_id: build.pk
      }),
      NotesPanel({
        model_type: ModelType.build,
        model_id: build.pk,
        has_note: !!build.notes
      })
    ];
  }, [
    build,
    id,
    user,
    buildStatus,
    globalSettings,
    showChildBuilds,
    buildLineQuery.isFetching,
    buildLineQuery.isLoading,
    buildLineData,
    openCatalogModal
  ]);

  const editBuildOrderFields = useBuildOrderFields({
    create: false,
    modalId: 'edit-build-order'
  });

  const editBuild = useEditApiFormModal({
    url: ApiEndpoints.build_order_list,
    pk: build.pk,
    title: t`Edit Build Order`,
    modalId: 'edit-build-order',
    fields: editBuildOrderFields,
    queryParams: new URLSearchParams({ tags: 'true' }),
    onFormSuccess: refreshInstance
  });

  const duplicateBuildOrderInitialData = useMemo(() => {
    const data = { ...build };
    delete data.reference;
    return data;
  }, [build]);

  const duplicateBuildOrderFields = useBuildOrderFields({
    create: false,
    duplicateBuildId: build.pk,
    modalId: 'duplicate-build-order'
  });

  const duplicateBuild = useCreateApiFormModal({
    url: ApiEndpoints.build_order_list,
    title: t`Add Build Order`,
    modalId: 'duplicate-build-order',
    fields: duplicateBuildOrderFields,
    initialData: duplicateBuildOrderInitialData,
    follow: true,
    modelType: ModelType.build
  });

  const cancelOrder = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.build_order_cancel, build.pk),
    title: t`Cancel Build Order`,
    onFormSuccess: refreshInstance,
    successMessage: t`Order cancelled`,
    preFormWarning: t`Cancel this order`,
    fields: {
      remove_allocated_stock: {},
      remove_incomplete_outputs: {}
    }
  });

  const holdOrder = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.build_order_hold, build.pk),
    title: t`Hold Build Order`,
    onFormSuccess: refreshInstance,
    preFormWarning: t`Place this order on hold`,
    successMessage: t`Order placed on hold`
  });

  const issueOrder = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.build_order_issue, build.pk),
    title: t`Issue Build Order`,
    onFormSuccess: refreshInstance,
    preFormWarning: t`Issue this order`,
    successMessage: t`Order issued`
  });

  const completeOrderFields: ApiFormFieldSet = useMemo(() => {
    const hasBom = (buildLineData?.count ?? 0) > 0;

    return {
      accept_overallocated: {
        hidden: !hasBom
      },
      accept_unallocated: {
        hidden: !hasBom
      },
      accept_incomplete: {}
    };
  }, [buildLineData.count]);

  const completeOrder = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.build_order_complete, build.pk),
    title: t`Complete Build Order`,
    onFormSuccess: refreshInstance,
    preFormContent: (
      <Alert
        color='green'
        icon={<IconCircleCheck />}
        title={t`Mark this order as complete`}
      />
    ),
    successMessage: t`Order completed`,
    fields: completeOrderFields
  });

  const buildActions = useMemo(() => {
    const canEdit = user.hasChangeRole(UserRoles.build);

    const canIssue =
      canEdit &&
      (build.status == buildStatus.PENDING ||
        build.status == buildStatus.ON_HOLD);

    const canComplete = canEdit && build.status == buildStatus.PRODUCTION;

    const canHold =
      canEdit &&
      (build.status == buildStatus.PENDING ||
        build.status == buildStatus.PRODUCTION);

    const canCancel =
      canEdit &&
      (build.status == buildStatus.PENDING ||
        build.status == buildStatus.ON_HOLD ||
        build.status == buildStatus.PRODUCTION);

    return [
      <PrimaryActionButton
        title={t`Issue Order`}
        icon='issue'
        hidden={!canIssue}
        color='blue'
        onClick={issueOrder.open}
      />,
      <PrimaryActionButton
        title={t`Complete Order`}
        icon='complete'
        hidden={!canComplete}
        color='green'
        onClick={completeOrder.open}
      />,
      <AdminButton model={ModelType.build} id={build.pk} />,
      <BarcodeActionDropdown
        model={ModelType.build}
        pk={build.pk}
        hash={build?.barcode_hash}
      />,
      <PrintingActions
        modelType={ModelType.build}
        items={[build.pk]}
        enableLabels
        enableReports
      />,
      <OptionsActionDropdown
        tooltip={t`Build Order Actions`}
        actions={[
          EditItemAction({
            onClick: () => editBuild.open(),
            hidden: !canEdit,
            tooltip: t`Edit order`
          }),
          DuplicateItemAction({
            onClick: () => duplicateBuild.open(),
            tooltip: t`Duplicate order`,
            hidden: !user.hasAddRole(UserRoles.build)
          }),
          HoldItemAction({
            tooltip: t`Hold order`,
            hidden: !canHold,
            onClick: holdOrder.open
          }),
          CancelItemAction({
            tooltip: t`Cancel order`,
            onClick: cancelOrder.open,
            hidden: !canCancel
          })
        ]}
      />
    ];
  }, [id, build, user, buildStatus]);

  const buildBadges = useMemo(() => {
    return instanceQuery.isFetching
      ? []
      : [
          <StatusRenderer
            status={build.status_custom_key || build.status}
            type={ModelType.build}
            options={{ size: 'lg' }}
          />,
          <DetailsBadge
            label={t`External`}
            color='blue'
            key='external'
            visible={build.external}
          />
        ];
  }, [build, instanceQuery]);

  return (
    <>
      {editBuild.modal}
      {duplicateBuild.modal}
      {cancelOrder.modal}
      {holdOrder.modal}
      {issueOrder.modal}
      {completeOrder.modal}

{/* Interactive Catalog Multi-Selection Modal */}
      <Modal
        opened={catalogModalOpened}
        onClose={closeCatalogModal}
        title={t`Select Required Parts from Catalog`}
        size='85%'
      >
        <Stack gap='md'>
          <ScrollArea h={500}>
            <PartListTable
              props={{
                enableSelection: true,
                
                // Force-hide all toolbar action icons
                allowAdd: false,
                enableAdd: false,
                enableReports: false,
                enableLabels: false,
                enableDownload: false,
                enableBulkDelete: false,
                enableMassDelete: false,
                tableActions: [],
                customActionGroups: [],
                
                // Catch all possible InvenTree selection state variations
                onRowSelectionChange: (data: any) => {
                  if (Array.isArray(data)) {
                    // If it returns an array of row objects
                    setSelectedPartIds(data.map((r: any) => r.pk ?? r.id));
                  } else if (typeof data === 'object' && data !== null) {
                    // If it returns a Tanstack state object like { "123": true, "124": false }
                    const selectedKeys = Object.keys(data)
                      .filter((key) => data[key])
                      .map(Number)
                      .filter((n) => !isNaN(n));
                    setSelectedPartIds(selectedKeys);
                  }
                },
                // Fallback for older InvenTree table versions
                onSelectedRecords: (records: any[]) => {
                  if (Array.isArray(records)) {
                    setSelectedPartIds(records.map((r: any) => r.pk ?? r.id));
                  }
                },
                
                params: {
                  active: true
                }
              } as any}
            />
          </ScrollArea>
          <Group justify='space-between' mt='md'>
            <Text size='sm' fw={500}>
              {selectedPartIds.length} {t`parts selected`}
            </Text>
            <Group>
              <Button variant='default' onClick={closeCatalogModal}>
                {t`Cancel`}
              </Button>
              <Button
                color='green'
                disabled={selectedPartIds.length === 0}
                loading={isSubmittingParts}
                onClick={handleAddSelectedParts}
              >
                {t`Add Selected Parts (${selectedPartIds.length})`}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <InstanceDetail query={instanceQuery} requiredRole={UserRoles.build}>
        <Stack gap='xs'>
          <PageDetail
            title={`${t`Build Order`}: ${build.reference}`}
            subtitle={`${build.quantity} x ${build.part_detail?.full_name}`}
            badges={buildBadges}
            editAction={editBuild.open}
            editEnabled={user.hasChangePermission(ModelType.part)}
            imageUrl={build.part_detail?.image ?? build.part_detail?.thumbnail}
            breadcrumbs={[{ name: t`Projects`, url: '/projects' }]}
            lastCrumb={[
              {
                name: build.reference,
                url: getDetailUrl(ModelType.build, build.pk)
              }
            ]}
            actions={buildActions}
          />
          <PanelGroup
            pageKey='build'
            panels={buildPanels}
            instance={build}
            reloadInstance={refreshInstance}
            model={ModelType.build}
            id={build.pk}
          />
        </Stack>
      </InstanceDetail>
    </>
  );
}