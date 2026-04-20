/** 统一请求方法集合。 */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
/** 请求体支持的输入类型。 */
export type RequestPayload = Record<string, any> | FormData

/** 解析后的单条 SSE 消息。 */
export interface SseMessage<T = unknown> {
    event: string
    id?: string
    retry?: number
    data: T | string | null
    rawData: string
}

/** 未授权请求异常，供宿主和插件统一识别。 */
export class UnauthorizedError extends Error {
    code = 419
    payload?: unknown

    constructor(message = 'Unauthorized', payload?: unknown) {
        super(message)
        this.name = 'UnauthorizedError'
        this.payload = payload
    }
}

/** 常见后端业务响应包裹结构。 */
export interface BusinessEnvelope<T> {
    code?: number
    message?: string
    data?: T | null
    result?: T | null
    items?: T | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnauthorizedPayload(value: unknown) {
    return isRecord(value) && Number(value.code) === 419
}

/**
 * 解析标准业务响应包裹。
 *
 * 支持 `data` / `result` / `items` 三种常见承载字段；
 * 若业务状态码非 `0`，会直接抛出异常。
 */
export function unwrapBusinessEnvelope<T>(response: T | BusinessEnvelope<T> | null | undefined) {
    if (!response || typeof response !== 'object') {
        return null
    }

    if ('code' in response && typeof response.code === 'number' && response.code !== 0) {
        const responseMessage = 'message' in response && typeof response.message === 'string' ? response.message.trim() : ''
        throw new Error(responseMessage || `接口请求失败，业务状态码：${response.code}`)
    }

    if ('data' in response || 'result' in response || 'items' in response) {
        return response.data || response.result || response.items || null
    }

    return response as T
}

function createSearchParams(params?: Record<string, any>) {
    const searchParams = new URLSearchParams()

    for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null || value === '') {
            continue
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                if (item === undefined || item === null || item === '') {
                    continue
                }

                searchParams.append(key, String(item))
            }
            continue
        }

        searchParams.append(key, String(value))
    }

    return searchParams
}

function buildRequestHeaders(options: {
    token?: string
    headers?: Record<string, any>
    accept?: string
}) {
    const headers: Record<string, string> = {
        Accept: options.accept || 'application/json',
        ...Object.fromEntries(
            Object.entries(options.headers || {}).flatMap(([key, value]) => {
                if (value === undefined || value === null || value === '') {
                    return []
                }

                return [[key, String(value)]]
            }),
        ),
    }

    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`
    }

    return headers
}

function buildRequestBody(options: {
    method: RequestMethod
    data?: RequestPayload
    headers: Record<string, string>
}) {
    if (options.method === 'GET' || !options.data) {
        return undefined
    }

    if (typeof FormData !== 'undefined' && options.data instanceof FormData) {
        return options.data
    }

    options.headers['Content-Type'] = 'application/json'
    return JSON.stringify(options.data)
}

function parseJSONTextPayload(text: string) {
    try {
        return JSON.parse(text) as unknown
    }
    catch {
        return text
    }
}

function resolveSSEMessageData<T>(rawData: string) {
    if (!rawData.trim()) {
        return null
    }

    return parseJSONTextPayload(rawData) as T | string
}

function parseRawSSEBlock<T>(block: string) {
    const rawData = block.trim()
    const data = resolveSSEMessageData<T>(rawData)
    let event = 'message'

    if (isRecord(data)) {
        if (typeof data.event === 'string' && data.event.trim()) {
            event = data.event.trim()
        }
        else if (typeof data.type === 'string' && data.type.trim().toLowerCase() === 'error') {
            event = 'error'
        }
    }

    return {
        event,
        data,
        rawData,
    } as SseMessage<T>
}

function parseSSEBlock<T>(block: string) {
    const message: SseMessage<T> = {
        event: 'message',
        data: null,
        rawData: '',
    }
    const dataLines: string[] = []
    let hasStructuredField = false

    for (const rawLine of block.split(/\r?\n/)) {
        if (!rawLine || rawLine.startsWith(':')) {
            continue
        }

        const separatorIndex = rawLine.indexOf(':')
        const field = separatorIndex >= 0 ? rawLine.slice(0, separatorIndex) : rawLine
        const value = separatorIndex >= 0 ? rawLine.slice(separatorIndex + 1).replace(/^ /, '') : ''

        if (field === 'event') {
            hasStructuredField = true
            message.event = value || 'message'
            continue
        }

        if (field === 'data') {
            hasStructuredField = true
            dataLines.push(value)
            continue
        }

        if (field === 'id') {
            hasStructuredField = true
            message.id = value
            continue
        }

        if (field === 'retry') {
            hasStructuredField = true
            const retry = Number.parseInt(value, 10)
            if (Number.isFinite(retry)) {
                message.retry = retry
            }
        }
    }

    if (!hasStructuredField) {
        return parseRawSSEBlock<T>(block)
    }

    message.rawData = dataLines.join('\n')
    message.data = resolveSSEMessageData<T>(message.rawData)

    return message
}

async function emitSSEMessage<T>(
    messages: SseMessage<T>[],
    message: SseMessage<T>,
    onMessage?: ((message: SseMessage<T>) => void | Promise<void>),
) {
    messages.push(message)

    if (onMessage) {
        await onMessage(message)
    }
}

async function processSSEBlock<T>(
    messages: SseMessage<T>[],
    block: string,
    targetURL: string,
    method: RequestMethod,
    onMessage?: ((message: SseMessage<T>) => void | Promise<void>),
) {
    const message = parseSSEBlock<T>(block)

    // 判断是否完成授权
    if (isUnauthorizedPayload(message.data)) {
        throw new UnauthorizedError(
            isRecord(message.data) && typeof message.data.message === 'string' && message.data.message.trim()
                ? message.data.message.trim()
                : `Request unauthorized: ${method} ${targetURL}`,
            message.data,
        )
    }

    await emitSSEMessage(messages, message, onMessage)
}

async function flushSSEBuffer<T>(
    messages: SseMessage<T>[],
    state: { buffer: string },
    targetURL: string,
    method: RequestMethod,
    onMessage?: ((message: SseMessage<T>) => void | Promise<void>),
    flushRemaining = false,
) {
    const chunks = state.buffer.split(/\r?\n\r?\n/)
    const blocks = flushRemaining ? chunks : chunks.slice(0, -1)
    state.buffer = flushRemaining ? '' : chunks[chunks.length - 1] || ''

    for (const chunk of blocks) {
        const block = chunk.trim()
        if (!block) {
            continue
        }

        await processSSEBlock(messages, block, targetURL, method, onMessage)
    }
}

/** 组合 baseURL、相对路径和查询参数，得到最终请求地址。 */
export function resolveRequestUrl(baseURL: string, url: string, params?: Record<string, any>) {
    const normalizedBaseURL = baseURL.replace(/\/+$/, '')
    const normalizedURL = /^https?:\/\//.test(url)
        ? url
        : `${normalizedBaseURL}/${url.replace(/^\/+/, '')}`

    const searchParams = createSearchParams(params)
    const queryString = searchParams.toString()

    if (!queryString) {
        return normalizedURL
    }

    return `${normalizedURL}${normalizedURL.includes('?') ? '&' : '?'}${queryString}`
}

/** 发起标准 JSON 请求，不主动拆解业务包裹结构。 */
export async function requestJson<T>(options: {
    baseURL: string
    url: string
    method: RequestMethod
    token?: string
    headers?: Record<string, any>
    params?: Record<string, any>
    data?: RequestPayload
}) {
    const targetURL = resolveRequestUrl(options.baseURL, options.url, options.params)
    const headers = buildRequestHeaders(options)
    const body = buildRequestBody({
        method: options.method,
        data: options.data,
        headers,
    })

    const response = await fetch(targetURL, {
        method: options.method,
        headers,
        body,
    })

    if (response.status === 204) {
        return {} as T
    }

    const text = await response.text()

    if (response.status === 419) {
        throw new UnauthorizedError(`Request unauthorized: ${options.method} ${targetURL}`)
    }

    if (!text) {
        if (!response.ok) {
            throw new Error(`Request failed: ${options.method} ${targetURL} (${response.status})`)
        }

        return {} as T
    }

    const payload = parseJSONTextPayload(text)

    // 判断是否授权
    if (isUnauthorizedPayload(payload)) {
        throw new UnauthorizedError(
            isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()
                ? payload.message.trim()
                : `Request unauthorized: ${options.method} ${targetURL}`,
            payload,
        )
    }

    if (!response.ok) {
        throw new Error(`Request failed: ${options.method} ${targetURL} (${response.status})`)
    }

    return payload as T
}

/**
 * 发起 SSE 流式请求，并按空行边界逐条输出消息。
 *
 * 同时兼容标准 SSE 格式和“空行分隔 JSON 块”格式。
 */
export async function requestSseJson<T>(options: {
    baseURL: string
    url: string
    method?: RequestMethod
    token?: string
    headers?: Record<string, any>
    params?: Record<string, any>
    data?: RequestPayload
    onMessage?: (message: SseMessage<T>) => void | Promise<void>
}) {
    const method = options.method || 'GET'
    const targetURL = resolveRequestUrl(options.baseURL, options.url, options.params)
    const headers = buildRequestHeaders({
        token: options.token,
        headers: options.headers,
        accept: 'text/event-stream, application/json',
    })
    const body = buildRequestBody({
        method,
        data: options.data,
        headers,
    })

    const response = await fetch(targetURL, {
        method,
        headers,
        body,
    })

    if (response.status === 419) {
        throw new UnauthorizedError(`Request unauthorized: ${method} ${targetURL}`)
    }

    if (!response.ok) {
        throw new Error(`Request failed: ${method} ${targetURL} (${response.status})`)
    }

    const messages: SseMessage<T>[] = []

    if (!response.body) {
        const text = await response.text()
        if (!text) {
            return messages
        }

        const state = { buffer: text }
        await flushSSEBuffer(messages, state, targetURL, method, options.onMessage, true)

        return messages
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const state = { buffer: '' }

    while (true) {
        const { done, value } = await reader.read()
        state.buffer += decoder.decode(value, { stream: !done })
        await flushSSEBuffer(messages, state, targetURL, method, options.onMessage, done)

        if (done) {
            break
        }
    }

    return messages
}
