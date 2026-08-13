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
  IconInfoCircle,
  IconLink,
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

/**
 * Panel to display the lines of a build order / project
 */
function BuildLinesPanel({
  build,
  isLoading
}: Readonly<{
  build: any;
  isLoading: boolean;
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
        <Alert color='blue' icon={<IconSitemap />} title='Source Location'>
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

  // Catalog selection state
  const [catalogModalOpened, { open: openCatalogModal, close: closeCatalogModal }] =
    useDisclosure(false);
  const [selectedParts, setSelectedParts] = useState<any[]>([]);
  const [isSubmittingParts, setIsSubmittingParts] = useState(false);

  // Attach Purchase Order selection state
  const [attachPoModalOpened, { open: openAttachPoModal, close: closeAttachPoModal }] =
    useDisclosure(false);
  const [selectedPosToAttach, setSelectedPosToAttach] = useState<any[]>([]);
  const [isAttachingPo, setIsAttachingPo] = useState(false);

  // Extract primary keys from selected catalog items
  const selectedPartIds = useMemo(() => {
    return selectedParts
      .map((p) => (typeof p === 'number' ? p : (p?.pk ?? p?.id)))
      .filter((id): id is number => typeof id === 'number' && !isNaN(id));
  }, [selectedParts]);

  // Extract primary keys from selected POs in attach modal
  const selectedPoIds = useMemo(() => {
    return selectedPosToAttach
      .map((po) => (typeof po === 'number' ? po : (po?.pk ?? po?.id)))
      .filter((id): id is number => typeof id === 'number' && !isNaN(id));
  }, [selectedPosToAttach]);

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
      tags: true,
      responsible_detail: true,
      issued_by_detail: true,
      take_from_detail: true,
      location_detail: true
    },
    hasPrimaryKey: true,
    defaultValue: {},
    refetchOnMount: true
  });

  // Consolidate or batch-add selected catalog parts into BOM
  const handleAddSelectedParts = async () => {
    if (selectedPartIds.length === 0) return;
    setIsSubmittingParts(true);

    try {
      const assemblyPartId = build?.part;

      if (!assemblyPartId) {
        throw new Error('Build order is missing parent assembly part ID');
      }

      const partCounts: Record<number, number> = {};
      for (const id of selectedPartIds) {
        partCounts[id] = (partCounts[id] || 0) + 1;
      }

      const existingBomResponse = await api.get(apiUrl(ApiEndpoints.bom_list), {
        params: { part: assemblyPartId }
      });

      const existingBomItems: any[] = Array.isArray(existingBomResponse?.data)
        ? existingBomResponse.data
        : existingBomResponse?.data?.results || [];

      for (const [partIdStr, qtyToAdd] of Object.entries(partCounts)) {
        const partId = Number(partIdStr);
        const existingItem = existingBomItems.find(
          (item: any) =>
            item.sub_part === partId || item.sub_part_detail?.pk === partId
        );

        if (existingItem) {
          const currentQty = Number(existingItem.quantity) || 0;
          await api.patch(apiUrl(ApiEndpoints.bom_list, existingItem.pk), {
            quantity: currentQty + qtyToAdd
          });
        } else {
          await api.post(apiUrl(ApiEndpoints.bom_list), {
            part: assemblyPartId,
            sub_part: partId,
            quantity: qtyToAdd
          });
        }
      }

      notifications.show({
        title: 'Required Items Updated',
        message: 'Items consolidated into project list successfully',
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
        title: 'Failed to update parts'
      });
    } finally {
      setIsSubmittingParts(false);
    }
  };

// Attach selected existing POs to this project (regardless of PO status)
  const handleAttachSelectedPos = async () => {
    if (selectedPoIds.length === 0) return;
    setIsAttachingPo(true);

    try {
      const projectRef = build.reference || `PROJ-${build.pk}`;

      const results = await Promise.allSettled(
        selectedPoIds.map((poId) =>
          api.patch(apiUrl(ApiEndpoints.purchase_order_list, poId), {
            project_code: projectRef,
            description: `Linked to Project ${projectRef}`
          })
        )
      );

      const failed = results.filter((r) => r.status === 'rejected');

      if (failed.length > 0) {
        notifications.show({
          title: 'Attachment Completed with Warnings',
          message: `${selectedPoIds.length - failed.length} PO(s) attached. Some completed POs may require administrator edit permissions in backend settings.`,
          color: 'orange'
        });
      } else {
        notifications.show({
          title: 'Purchase Orders Attached',
          message: `${selectedPoIds.length} Purchase Order(s) attached to Project ${projectRef}`,
          color: 'green'
        });
      }

      setSelectedPosToAttach([]);
      closeAttachPoModal();
      refreshInstance();
    } catch (err: any) {
      console.error('Failed to attach POs:', err);
      showApiErrorMessage({
        error: err,
        title: 'Failed to attach Purchase Order'
      });
    } finally {
      setIsAttachingPo(false);
    }
  };

  // Form modal to create a new Purchase Order linked to this project
  const createPurchaseOrderModal = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: 'Create Purchase Order for Project',
    modalId: 'create-po-for-project',
    fields: {
      supplier: {},
      reference: {},
      project_code: {},
      description: {},
      target_date: {}
    },
    initialData: {
      project_code: build.reference,
      description: `Purchase order for Project ${build.reference || ''}`
    },
    onFormSuccess: refreshInstance
  });

  const buildPanels: PanelType[] = useMemo(() => {
    const projectRef = build.reference || `PROJ-${build.pk}`;

    return [
      {
        name: 'details',
        label: 'Project Info',
        icon: <IconInfoCircle />,
        content: (
          <BuildOrderDetailsPanel
            instance={build}
            refreshInstance={refreshInstance}
          />
        )
      },
      {
        name: 'line-items',
        label: 'Required Items',
        icon: <IconListNumbers />,
        content: (
          <Stack gap='md'>
            <Group justify='space-between'>
              <Title order={4}>Required Items</Title>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openCatalogModal}
              >
                Select from Catalog
              </Button>
            </Group>
            <BuildLinesPanel
              build={build}
              isLoading={buildLineQuery.isFetching || buildLineQuery.isLoading}
            />
          </Stack>
        )
      },
{
        name: 'purchase-orders',
        label: 'Purchase Orders',
        icon: <IconShoppingCart />,
        content: build.pk ? (
          <Stack gap='md'>
            <Group justify='space-between'>
              <Title order={4}>Project Purchase Orders</Title>
              <Group>
                <Button
                  variant='outline'
                  leftSection={<IconLink size={16} />}
                  onClick={openAttachPoModal}
                >
                  Attach Existing PO
                </Button>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={createPurchaseOrderModal.open}
                >
                  Create Purchase Order
                </Button>
              </Group>
            </Group>
            <PurchaseOrderTable filterProjectRef={projectRef} />
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
    buildLineQuery.isFetching,
    buildLineQuery.isLoading,
    openCatalogModal,
    openAttachPoModal,
    createPurchaseOrderModal.open
  ]);

  const editBuildOrderFields = useBuildOrderFields({
    create: false,
    modalId: 'edit-build-order'
  });

  const editBuild = useEditApiFormModal({
    url: ApiEndpoints.build_order_list,
    pk: build.pk,
    title: 'Edit Build Order',
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
    title: 'Add Build Order',
    modalId: 'duplicate-build-order',
    fields: duplicateBuildOrderFields,
    initialData: duplicateBuildOrderInitialData,
    follow: true,
    modelType: ModelType.build
  });

  const cancelOrder = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.build_order_cancel, build.pk),
    title: 'Cancel Build Order',
    onFormSuccess: refreshInstance,
    successMessage: 'Order cancelled',
    preFormWarning: 'Cancel this order',
    fields: {
      remove_allocated_stock: {},
      remove_incomplete_outputs: {}
    }
  });

  const holdOrder = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.build_order_hold, build.pk),
    title: 'Hold Build Order',
    onFormSuccess: refreshInstance,
    preFormWarning: 'Place this order on hold',
    successMessage: 'Order placed on hold'
  });

  const issueOrder = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.build_order_issue, build.pk),
    title: 'Issue Build Order',
    onFormSuccess: refreshInstance,
    preFormWarning: 'Issue this order',
    successMessage: 'Order issued'
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
    title: 'Complete Build Order',
    onFormSuccess: refreshInstance,
    preFormContent: (
      <Alert
        color='green'
        icon={<IconCircleCheck />}
        title='Mark this order as complete'
      />
    ),
    successMessage: 'Order completed',
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
        title='Issue Order'
        icon='issue'
        hidden={!canIssue}
        color='blue'
        onClick={issueOrder.open}
      />,
      <PrimaryActionButton
        title='Complete Order'
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
        tooltip='Build Order Actions'
        actions={[
          EditItemAction({
            onClick: () => editBuild.open(),
            hidden: !canEdit,
            tooltip: 'Edit order'
          }),
          DuplicateItemAction({
            onClick: () => duplicateBuild.open(),
            tooltip: 'Duplicate order',
            hidden: !user.hasAddRole(UserRoles.build)
          }),
          HoldItemAction({
            tooltip: 'Hold order',
            hidden: !canHold,
            onClick: holdOrder.open
          }),
          CancelItemAction({
            tooltip: 'Cancel order',
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
            label='External'
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

      {/* Modal 1: Catalog Required Items Selection */}
      <Modal
        opened={catalogModalOpened}
        onClose={() => {
          setSelectedParts([]);
          closeCatalogModal();
        }}
        title='Select Required Items from Catalog'
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
              {selectedPartIds.length} items selected
            </Text>
            <Group>
              <Button
                variant='default'
                onClick={() => {
                  setSelectedParts([]);
                  closeCatalogModal();
                }}
              >
                Cancel
              </Button>
              <Button
                color='green'
                disabled={selectedPartIds.length === 0}
                loading={isSubmittingParts}
                onClick={handleAddSelectedParts}
              >
                Add Selected Items ({selectedPartIds.length})
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Modal 2: Attach Existing Purchase Order */}
      <Modal
        opened={attachPoModalOpened}
        onClose={() => {
          setSelectedPosToAttach([]);
          closeAttachPoModal();
        }}
        title='Attach Existing Purchase Order to Project'
        size='85%'
      >
        <Stack gap='md'>
          <Text size='sm' c='dimmed'>
            Search and select existing Purchase Orders to link to Project{' '}
            <b>{build.reference}</b>:
          </Text>
          <ScrollArea h={500}>
            <PurchaseOrderTable
              enableSelection={true}
              selectedRecords={selectedPosToAttach}
              onSelectedRecordsChange={setSelectedPosToAttach}
            />
          </ScrollArea>
          <Group justify='space-between' mt='md'>
            <Text size='sm' fw={500}>
              {selectedPoIds.length} Purchase Order(s) selected
            </Text>
            <Group>
              <Button
                variant='default'
                onClick={() => {
                  setSelectedPosToAttach([]);
                  closeAttachPoModal();
                }}
              >
                Cancel
              </Button>
              <Button
                color='blue'
                disabled={selectedPoIds.length === 0}
                loading={isAttachingPo}
                onClick={handleAttachSelectedPos}
              >
                Attach Selected POs ({selectedPoIds.length})
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <InstanceDetail query={instanceQuery} requiredRole={UserRoles.build}>
        <Stack gap='xs'>
          <PageDetail
            title={`Build Order: ${build.reference}`}
            subtitle={`${build.quantity} x ${build.part_detail?.full_name}`}
            badges={buildBadges}
            editAction={editBuild.open}
            editEnabled={user.hasChangePermission(ModelType.part)}
            imageUrl={build.part_detail?.image ?? build.part_detail?.thumbnail}
            breadcrumbs={[{ name: 'Projects', url: '/projects' }]}
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