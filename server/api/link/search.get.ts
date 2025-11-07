interface Link {
  slug: string
  url: string
  comment?: string
}

export default eventHandler(async (event) => {
  const { cloudflare } = event.context
  const { KV } = cloudflare.env
  const list: Link[] = []
  let finalCursor: string | undefined

  try {
    while (true) {
      const { keys, list_complete, cursor } = await KV.list({
        prefix: `link:`,
        limit: 1000,
        cursor: finalCursor,
      })

      finalCursor = cursor

      if (Array.isArray(keys)) {
        for (const key of keys) {
          try {
            if (key.metadata?.url) {
              list.push({
                slug: key.name.replace('link:', ''),
                url: key.metadata.url,
                comment: key.metadata.comment,
              })
            }
            else {
              // Forward compatible with links without metadata
              const { metadata, value: link } = await KV.getWithMetadata(key.name, { type: 'json' })
              if (link) {
                list.push({
                  slug: key.name.replace('link:', ''),
                  url: link.url,
                  comment: link.comment,
                })
                // Do not rewrite metadata with large fields (e.g., url/comment) to avoid KV metadata size limits
              }
            }
          }
          catch (err) {
            console.error(`Error processing key ${key.name}:`, err)
            continue // Skip this key and continue with the next one
          }
        }
      }

      if (!keys || list_complete) {
        break
      }
    }
    return list
  }
  catch (err) {
    console.error('Error fetching link list:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch link list',
    })
  }
})
