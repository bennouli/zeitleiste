import type {
    Access,
    AccessResult,
    CollectionConfig,
    FieldAccess,
    PayloadRequest,
} from 'payload'

export const isAdmin = (user: PayloadRequest['user']): boolean =>
    user?.role === 'admin'

export const adminOnly: Access = ({ req }) => isAdmin(req.user)

export const adminOnlyField: FieldAccess = ({ req }) => isAdmin(req.user)

export const loggedIn: Access = ({ req }) => Boolean(req.user)

export const ownerOr =
    (anonymousAccess: AccessResult): Access =>
    ({ req: { user } }) =>
        user ? { owner: { equals: user.id } } : anonymousAccess

export const ownerOnly: Access = ownerOr(false)

export const ownedAccess = (
    anonymousRead: AccessResult
): NonNullable<CollectionConfig['access']> => ({
    create: loggedIn,
    read: ownerOr(anonymousRead),
    update: ownerOnly,
    delete: ownerOnly,
})

export const adminOrSelf: Access = ({ req: { user } }) => {
    if (isAdmin(user)) return true
    return user ? { id: { equals: user.id } } : false
}

export const hasNoUsers = async (req: PayloadRequest): Promise<boolean> =>
    (await req.payload.count({ collection: 'users', req })).totalDocs === 0

export const adminOrFirstUser: Access = async ({ req }) =>
    isAdmin(req.user) || hasNoUsers(req)
