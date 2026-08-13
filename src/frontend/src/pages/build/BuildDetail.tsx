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
import { notifications } from '@mantine/notifications';
import {
  IconCircleCheck,
  IconExclamationCircle,
  IconInfoCircle,
  IconListNumbers,
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
import { StatusRenderer } from '../../components/render/StatusRenderer';
import { RenderStockLocation } from '../../components/render/Stock';
import { useApi } from '../../contexts/ApiContext';
import { useBuildOrderFields } from '../../forms/BuildForms';
import { showApiErrorMessage } from '../../functions/notifications';
import {
  useCreateApiFormModal,
  useEditApiFormModal
} from '../../hooks/UseForm';
import { useInstance } from '../../hooks/UseInstance';
import useStatusCodes from '../../hooks/UseStatusCodes';
import { useGlobalSettingsState } from '../../states/SettingsStates';
import { useUserState } from '../../states/UserState';
import BuildLineTable from '../../tables/build/BuildLineTable';
import { PartListTable } from '../../tables/part/PartTable';
import { PurchaseOrderTable } from '../../tables/purchasing/PurchaseOrderTable';
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
/**
 * Panel to display the lines of a build order / project
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
      {buildLocation.instance.pk && (
        <Alert color='blue' icon={<IconSitemap />} title={t`Source Location`}>
          <RenderStockLocation instance={buildLocation.instance} />
        </Alert>
      )}
      <BuildLineTable build={build} />
    </Stack>
  );
}

/**
 * Detail page for a single Build Order / Project
 */
export default function BuildDetail() {
  const { id } = useParams();
  const api = useApi();

  const user = useUserState();
  const globalSettings = useGlobalSettingsState();

  // Modal open/close state for catalog multi-selection
  const [catalogModalOpened, { open: openCatalogModal, close: closeCatalogModal }] =
    useDisclosure(false);
  const [selectedParts, setSelectedParts] = useState<any[]>([]);
  const [isSubmittingParts, setIsSubmittingParts] = useState(false);

  // Extract primary keys from selected table record objects
  const selectedPartIds = useMemo(() => {
    return selectedParts
      .map((p) => (typeof p === 'number' ? p : (p?.pk ?? p?.id)))
      .filter((id): id is number => typeof id === 'number' && !isNaN(id));
  }, [selectedParts]);

  // Bind selection state directly to Mantine DataTable
  const catalogTableProps = useMemo(
    () => ({
      enableSelection: true,
      selectedRecords: selectedParts,
      onSelectedRecordsChange: setSelectedParts,
      params: { active: true }
    }),
    [selectedParts]
  );

  // Fetch BOM items count
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

  // Fetch subassembly BOM items count
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

  // Fetch child builds count
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
  
// Batch-add or consolidate selected catalog parts into the build assembly's BOM
  const handleAddSelectedParts = async () => {
    if (selectedPartIds.length === 0) return;
    setIsSubmittingParts(true);

    try {
      const assemblyPartId = build?.part;

      if (!assemblyPartId) {
        throw new Error(t`Build order is missing parent assembly part ID`);
      }

      // 1. Group selected IDs to calculate quantities to add per unique part
      const partCounts: Record<number, number> = {};
      for (const id of selectedPartIds) {
        partCounts[id] = (partCounts[id] || 0) + 1;
      }

      // 2. Fetch existing BOM items for this assembly
      const existingBomResponse = await api.get(apiUrl(ApiEndpoints.bom_list), {
        params: { part: assemblyPartId }
      });

      const existingBomItems: any[] = Array.isArray(existingBomResponse?.data)
        ? existingBomResponse.data
        : existingBomResponse?.data?.results || [];

      // 3. Consolidate with existing lines or post new lines
      for (const [partIdStr, qtyToAdd] of Object.entries(partCounts)) {
        const partId = Number(partIdStr);
        const existingItem = existingBomItems.find(
          (item: any) =>
            item.sub_part === partId || item.sub_part_detail?.pk === partId
        );

        if (existingItem) {
          // Update existing line by incrementing quantity
          const currentQty = Number(existingItem.quantity) || 0;
          await api.patch(apiUrl(ApiEndpoints.bom_list, existingItem.pk), {
            quantity: currentQty + qtyToAdd
          });
        } else {
          // Create new line
          await api.post(apiUrl(ApiEndpoints.bom_list), {
            part: assemblyPartId,
            sub_part: partId,
            quantity: qtyToAdd
          });
        }
      }

      notifications.show({
        title: t`Required Items Updated`,
        message: t`Items consolidated into project list successfully`,
        color: 'green',
        id: 'add-required-parts-success'
      });

      setSelectedParts([]);
      closeCatalogModal();

      await buildLineQuery.refetch();
      refreshInstance();
    } catch (err: any) {
      console.error('Failed to update project parts:', err);
      showApiErrorMessage({
        error: err,
        title: t`Failed to update parts`
      });
    } finally {
      setIsSubmittingParts(false);
    }
  };

  // Form modal to create a new Purchase Order linked to this project
  const createPurchaseOrderModal = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: t`Create Purchase Order for Project`,
    modalId: 'create-po-for-project',
    fields: {
      supplier: {},
      reference: {},
      description: {},
      external_build: {
        hidden: true,
        value: build.pk
      },
      target_date: {}
    },
    initialData: {
      external_build: build.pk,
      description: `Purchase order for Project ${build.reference || ''}`
    },
    onFormSuccess: refreshInstance
  });

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
        label: t`Required Items`,
        icon: <IconListNumbers />,
        content: (
          <Stack gap='md'>
            <Group justify='space-between'>
              <Title order={4}>{t`Required Items`}</Title>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openCatalogModal}
              >
                {t`Select from Catalog`}
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
          <Stack gap='md'>
            <Group justify='space-between'>
              <Title order={4}>{t`Project Purchase Orders`}</Title>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={createPurchaseOrderModal.open}
              >
                {t`Create Purchase Order for Project`}
              </Button>
            </Group>
            <PurchaseOrderTable params={{ external_build: build.pk }} />
          </Stack>
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
    openCatalogModal,
    createPurchaseOrderModal.open
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
      {createPurchaseOrderModal.modal}

      {/* Interactive Catalog Multi-Selection Modal */}
      <Modal
        opened={catalogModalOpened}
        onClose={() => {
          setSelectedParts([]);
          closeCatalogModal();
        }}
        title={t`Select Required Items from Catalog`}
        size='85%'
      >
        <Stack gap='md'>
          <ScrollArea h={500}>
          <PartListTable
            allowAdd={false}
            enableReports={false}
            enableLabels={false}
            onSelectedRecordsChange={setSelectedParts}
            props={{
              params: { active: true }
            }}
          />
          </ScrollArea>
          <Group justify='space-between' mt='md'>
            <Text size='sm' fw={500}>
              {selectedPartIds.length} {t`items selected`}
            </Text>
            <Group>
              <Button
                variant='default'
                onClick={() => {
                  setSelectedParts([]);
                  closeCatalogModal();
                }}
              >
                {t`Cancel`}
              </Button>
              <Button
                color='green'
                disabled={selectedPartIds.length === 0}
                loading={isSubmittingParts}
                onClick={handleAddSelectedParts}
              >
                {t`Add Selected Items (${selectedPartIds.length})`}
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