import RootLayout from './(frontend)/layout'
import NotFound from './(frontend)/not-found'

export { metadata } from './(frontend)/layout'

export default function GlobalNotFound() {
    return (
        <RootLayout>
            <NotFound />
        </RootLayout>
    )
}
