/** Makes everything on the page outside `el` inert; the returned function undoes exactly that. */
export function inertOutside(el: HTMLElement): () => void {
    const siblingsMadeInert = siblingsOfAncestors(el).filter(
        (sibling) => !sibling.hasAttribute('inert')
    )
    siblingsMadeInert.forEach((sibling) => sibling.setAttribute('inert', ''))
    return () =>
        siblingsMadeInert.forEach((sibling) => sibling.removeAttribute('inert'))
}

function siblingsOfAncestors(el: HTMLElement): Element[] {
    const lineage: Element[] = []
    for (
        let node: Element | null = el;
        node && node !== document.body;
        node = node.parentElement
    )
        lineage.push(node)
    return lineage.flatMap((node) =>
        [...(node.parentElement?.children ?? [])].filter(
            (sibling) => sibling !== node
        )
    )
}
