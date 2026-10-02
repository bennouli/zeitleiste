import type {
    CollectionConfig,
    FieldHook,
    RelationshipField,
    Where,
} from 'payload'

/** The logged-in user on create; a request without one (seed, scripts) keeps the owner it passes. */
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

/** The documents a relationship may point at: the user's own; anything for a request without a user. */
export const ownedBy = (user: { id?: number } | null | undefined): Where =>
    user?.id === undefined ? {} : { owner: { equals: user.id } }

/** Compound unique indexes on (owner, field), one per field. */
export const uniquePerOwner = (
    ...fields: string[]
): NonNullable<CollectionConfig['indexes']> =>
    fields.map((field) => ({ fields: ['owner', field], unique: true }))
