import { MEDIA_WIDTHS } from '@/lib/media'
import type { CollectionConfig } from 'payload'
import { loggedIn } from './userAccess'

export const mediaCollection = ({
    canStoreUploads,
}: {
    canStoreUploads: boolean
}): CollectionConfig => ({
    slug: 'media',
    labels: { singular: 'Bild', plural: 'Bilder' },
    admin: {
        useAsTitle: 'filename',
        defaultColumns: ['filename', 'alt', 'updatedAt'],
    },
    access: {
        read: () => true,
        create: (args) => canStoreUploads && loggedIn(args),
        update: loggedIn,
        delete: loggedIn,
    },
    upload: {
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
        imageSizes: MEDIA_WIDTHS.map((width) => ({
            name: `w${width}`,
            width,
            withoutEnlargement: true,
        })),
        adminThumbnail: 'w480',
    },
    fields: [
        {
            name: 'alt',
            type: 'text',
            label: 'Alternativtext',
            required: true,
            admin: {
                description:
                    'Beschreibt das Bild für alle, die es nicht sehen.',
            },
        },
        {
            name: 'caption',
            type: 'text',
            label: 'Bildunterschrift',
        },
        {
            name: 'credit',
            type: 'text',
            label: 'Quelle',
            admin: {
                description:
                    'Urheber oder Herkunft, z. B. „Wikimedia Commons“.',
            },
        },
    ],
})
