import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Users management page
 *
 * Admin-only route for managing users, roles, and invites.
 */
import { useLingui } from "@lingui/react/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { UserList, UserListSkeleton, UserDetail, InviteUserModal, useRolesConfig, } from "../components/users";
import { fetchUsers, fetchUser, updateUser, sendRecoveryLink, disableUser, enableUser, inviteUser, } from "../lib/api";
/**
 * Debounce hook for search input
 */
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = React.useState(value);
    React.useEffect(() => {
        const timer = setTimeout(setDebouncedValue, delay, value);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}
export function UsersPage() {
    const { t } = useLingui();
    const { getRoleLabel } = useRolesConfig();
    const queryClient = useQueryClient();
    // State
    const [searchQuery, setSearchQuery] = React.useState("");
    const [roleFilter, setRoleFilter] = React.useState();
    const [selectedUserId, setSelectedUserId] = React.useState(null);
    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [isInviteOpen, setIsInviteOpen] = React.useState(false);
    const [showDisableConfirm, setShowDisableConfirm] = React.useState(false);
    const [showDemoteConfirm, setShowDemoteConfirm] = React.useState(false);
    const [pendingSaveData, setPendingSaveData] = React.useState(null);
    const [inviteError, setInviteError] = React.useState(null);
    const [inviteUrl, setInviteUrl] = React.useState(null);
    // Debounced search
    const debouncedSearch = useDebounce(searchQuery, 300);
    // Queries
    const usersQuery = useInfiniteQuery({
        queryKey: ["users", debouncedSearch, roleFilter],
        queryFn: ({ pageParam }) => fetchUsers({
            search: debouncedSearch || undefined,
            role: roleFilter,
            cursor: pageParam,
        }),
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
    const userDetailQuery = useQuery({
        queryKey: ["users", selectedUserId],
        queryFn: () => fetchUser(selectedUserId),
        enabled: !!selectedUserId,
    });
    // Mutations
    const updateUserMutation = useMutation({
        mutationFn: ({ id, data }) => updateUser(id, data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["users"] });
            setShowDemoteConfirm(false);
            setPendingSaveData(null);
        },
    });
    const disableMutation = useMutation({
        mutationFn: (id) => disableUser(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["users"] });
            setShowDisableConfirm(false);
        },
    });
    const enableMutation = useMutation({
        mutationFn: (id) => enableUser(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
    const recoveryMutation = useMutation({
        mutationFn: (id) => sendRecoveryLink(id),
        onSuccess: () => {
            // Auto-clear success status after a few seconds
            setTimeout(() => recoveryMutation.reset(), 4000);
        },
    });
    const inviteMutation = useMutation({
        mutationFn: ({ email, role }) => inviteUser(email, role),
        onSuccess: (result) => {
            setInviteError(null);
            if (result.inviteUrl) {
                // No email provider — show copy-link view in the modal
                setInviteUrl(result.inviteUrl);
            }
            else {
                // Email sent — close modal
                setIsInviteOpen(false);
            }
            // Refresh user list (invite token was created either way)
            void queryClient.invalidateQueries({ queryKey: ["users"] });
        },
        onError: (error) => {
            setInviteError(error.message);
        },
    });
    // Handlers
    const handleSelectUser = (id) => {
        setSelectedUserId(id);
        setIsDetailOpen(true);
    };
    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        // Keep selectedUserId for a moment to prevent flicker
        setTimeout(setSelectedUserId, 200, null);
    };
    const handleSave = (data) => {
        if (!selectedUserId)
            return;
        // Check for role demotion — require confirmation.
        // Guard: only check when user data is loaded (currentRole defined).
        const currentRole = userDetailQuery.data?.role;
        if (data.role !== undefined && currentRole !== undefined && data.role < currentRole) {
            setPendingSaveData(data);
            setShowDemoteConfirm(true);
            return;
        }
        updateUserMutation.mutate({ id: selectedUserId, data });
    };
    const handleConfirmDemote = () => {
        if (selectedUserId && pendingSaveData) {
            updateUserMutation.mutate({ id: selectedUserId, data: pendingSaveData });
        }
    };
    const handleDisable = () => {
        setShowDisableConfirm(true);
    };
    const handleConfirmDisable = () => {
        if (selectedUserId) {
            disableMutation.mutate(selectedUserId);
        }
    };
    const handleEnable = () => {
        if (selectedUserId) {
            enableMutation.mutate(selectedUserId);
        }
    };
    const handleSendRecovery = () => {
        if (selectedUserId) {
            recoveryMutation.mutate(selectedUserId);
        }
    };
    const handleInvite = (email, role) => {
        setInviteError(null);
        inviteMutation.mutate({ email, role });
    };
    // Loading state
    if (usersQuery.isLoading && !usersQuery.data) {
        return _jsx(UserListSkeleton, {});
    }
    // Error state
    if (usersQuery.error) {
        return (_jsxs("div", { className: "rounded-lg border border-kumo-danger/50 bg-kumo-danger/10 p-6 text-center", children: [_jsx("p", { className: "text-kumo-danger", children: t `Failed to load users: ${usersQuery.error.message}` }), _jsx("button", { onClick: () => usersQuery.refetch(), className: "mt-4 text-sm text-kumo-link underline", children: t `Try again` })] }));
    }
    const users = usersQuery.data?.pages.flatMap((p) => p.items) ?? [];
    const selectedUser = userDetailQuery.data ?? null;
    return (_jsxs(_Fragment, { children: [_jsx(UserList, { users: users, isLoading: usersQuery.isFetching, hasMore: !!usersQuery.hasNextPage, searchQuery: searchQuery, roleFilter: roleFilter, onSearchChange: setSearchQuery, onRoleFilterChange: setRoleFilter, onSelectUser: handleSelectUser, onInviteUser: () => setIsInviteOpen(true), onLoadMore: () => void usersQuery.fetchNextPage() }), _jsx(UserDetail, { user: selectedUser, isLoading: userDetailQuery.isLoading, isOpen: isDetailOpen, isSaving: updateUserMutation.isPending, isSendingRecovery: recoveryMutation.isPending, recoverySent: recoveryMutation.isSuccess, recoveryError: recoveryMutation.error?.message ?? null, currentUserId: undefined, onClose: handleCloseDetail, onSave: handleSave, onDisable: handleDisable, onEnable: handleEnable, onSendRecovery: handleSendRecovery }), _jsx(InviteUserModal, { open: isInviteOpen, isSending: inviteMutation.isPending, error: inviteError, inviteUrl: inviteUrl, onOpenChange: (open) => {
                    setIsInviteOpen(open);
                    if (!open) {
                        setInviteError(null);
                        setInviteUrl(null);
                    }
                }, onInvite: handleInvite }), _jsx(ConfirmDialog, { open: showDisableConfirm, onClose: () => {
                    setShowDisableConfirm(false);
                    disableMutation.reset();
                }, title: t `Disable User?`, description: _jsxs(Trans, { children: ["Disabling ", _jsx("strong", { children: selectedUser?.name || selectedUser?.email }), " will prevent them from logging in until re-enabled. Their content will be preserved."] }), confirmLabel: t `Disable User`, pendingLabel: t `Disabling...`, isPending: disableMutation.isPending, error: disableMutation.error, onConfirm: handleConfirmDisable }), _jsx(ConfirmDialog, { open: showDemoteConfirm, onClose: () => {
                    setShowDemoteConfirm(false);
                    setPendingSaveData(null);
                    updateUserMutation.reset();
                }, title: t `Demote User?`, description: _jsxs(Trans, { children: ["Change ", _jsx("strong", { children: selectedUser?.name || selectedUser?.email }), " from", " ", _jsx("strong", { children: getRoleLabel(selectedUser?.role ?? 0) }), " to", " ", _jsx("strong", { children: getRoleLabel(pendingSaveData?.role ?? 0) }), "? They will lose access to higher-level features."] }), confirmLabel: t `Demote User`, pendingLabel: t `Demoting...`, isPending: updateUserMutation.isPending, error: updateUserMutation.error, onConfirm: handleConfirmDemote })] }));
}
