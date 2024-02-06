import { init_as_module } from './posthog-core'
export { PostHog } from './posthog-core'
export * from './types'
export * from './posthog-surveys-types'
export const posthog = init_as_module()
export default posthog

import { autocapture } from './autocapture'
export const internal = { autocapture }
