import type { Media } from '@/payload-types'
import { describe, expect, it } from 'vitest'
import { postImageSource } from '../postImage'

const ORIGINAL = { url: '/zar.png', width: 3200, height: 2000 }
const W480 = { url: '/zar-480.png', width: 480, height: 300 }
const W960 = { url: '/zar-960.png', width: 960, height: 600 }
const W1600 = { url: '/zar-1600.png', width: 1600, height: 1000 }

const mediaWith = (sizes: Media['sizes']): Media => ({
    id: 1,
    ...ORIGINAL,
    sizes,
    updatedAt: '',
    createdAt: '',
})

describe('postImageSource', () => {
    it('reserves the box of the widest copy and keys the image by its original', () => {
        const media = mediaWith({ w1600: W1600, w480: W480, w960: W960 })
        expect(postImageSource(media)).toMatchObject({
            src: '/zar.png',
            width: 1600,
            height: 1000,
        })
    })

    it('serves each width from the narrowest copy that covers it', () => {
        const media = mediaWith({ w1600: W1600, w480: W480, w960: W960 })
        const { urlForWidth } = postImageSource(media)!
        expect([1, 480, 481, 960, 1600].map(urlForWidth)).toEqual([
            '/zar-480.png',
            '/zar-480.png',
            '/zar-960.png',
            '/zar-960.png',
            '/zar-1600.png',
        ])
    })

    it('serves widths past the widest copy from the widest copy', () => {
        const media = mediaWith({ w480: W480, w960: W960, w1600: W1600 })
        expect(postImageSource(media)!.urlForWidth(3840)).toBe('/zar-1600.png')
    })

    it('ignores a copy Payload did not make', () => {
        const missingCopy = { url: null, width: null, height: null }
        const media = mediaWith({ w480: W480, w960: missingCopy })
        expect(postImageSource(media)!.urlForWidth(960)).toBe('/zar-480.png')
    })

    it('serves the original of an image without copies', () => {
        const media = mediaWith({})
        const source = postImageSource(media)!
        expect(source.width).toBe(3200)
        expect(source.urlForWidth(480)).toBe('/zar.png')
    })
})
