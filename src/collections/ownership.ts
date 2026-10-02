import type {
    CollectionConfig,
    FieldHook,
    RelationshipField,
    Where,
} from 'payload'

const stampOwnerOnCreate: FieldHook = ({ operation, req, value }) =>
    operation === 'create' && req.user ? req.user.id : value

export const ownerField: RelationshipField = {
    name: 'owner',
    type: 'relationship',
    label: 'Angelegt von',
    relationTo: 'users',
    required: true,
    defaultValue: ({ user }) => user?.id,
    access: { update: () => false },
    hooks: { beforeValidate: [stampOwnerOnCreate] },
    admin: { readOnly: true, position: 'sidebar' },
}

export const ownedBy = (user: { id?: number } | null | undefined): Where =>
    user?.id === undefined ? {} : { owner: { equals: user.id } }

export const uniquePerOwner = (
    ...fields: string[]
): NonNullable<CollectionConfig['indexes']> =>
    fields.map((field) => ({ fields: ['owner', field], unique: true }))
