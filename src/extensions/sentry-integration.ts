/**
 * Integrate Sentry with PostHog. This will add a direct link to the person in Sentry, and an $exception event in PostHog
 *
 * ### Usage
 *
 *     Sentry.init({
 *          dsn: 'https://example',
 *          integrations: [
 *              new posthog.SentryIntegration(posthog)
 *          ]
 *     })
 *
 * @param {Object} [posthog] The posthog object
 * @param {string} [organization] Optional: The Sentry organization, used to send a direct link from PostHog to Sentry
 * @param {Number} [projectId] Optional: The Sentry project id, used to send a direct link from PostHog to Sentry
 * @param {string} [prefix] Optional: Url of a self-hosted sentry instance (default: https://sentry.io/organizations/)
 */

import { PostHog } from '../posthog-core'

// NOTE - we can't import from @sentry/types because it changes frequently and causes clashes
// We only use a small subset of the types, so we can just define the integration overall and use any for the rest

// import {
//     Event as _SentryEvent,
//     EventProcessor as _SentryEventProcessor,
//     Hub as _SentryHub,
//     Integration as _SentryIntegration,
// } from '@sentry/types'

// Uncomment the above and comment the below to get type checking for development

type _SentryEvent = any
type _SentryEventProcessor = any
type _SentryHub = any

interface _SentryIntegration {
    name: string
    setupOnce(addGlobalEventProcessor: (callback: _SentryEventProcessor) => void, getCurrentHub: () => _SentryHub): void
}

interface SentryExceptionProperties {
    $sentry_event_id: any
    $sentry_exception: any
    $sentry_exception_message: any
    $sentry_exception_type: any
    $sentry_tags: any
    $sentry_url?: string
}

export class SentryIntegration implements _SentryIntegration {
    name: string

    setupOnce: (
        addGlobalEventProcessor: (callback: _SentryEventProcessor) => void,
        getCurrentHub: () => _SentryHub
    ) => void

    constructor(_posthog: PostHog, organization?: string, projectId?: number, prefix?: string) {
        // setupOnce gets called by Sentry when it intializes the plugin
        this.name = 'posthog-js'
        this.setupOnce = function (addGlobalEventProcessor: (callback: _SentryEventProcessor) => void) {
            addGlobalEventProcessor((event: _SentryEvent) => {
                if (event.level !== 'error' || !_posthog.__loaded) return event
                if (!event.tags) event.tags = {}

                const personUrl = _posthog.requestRouter.endpointFor('ui', '/person/' + _posthog.get_distinct_id())
                event.tags['PostHog Person URL'] = personUrl
                if (_posthog.sessionRecordingStarted()) {
                    event.tags['PostHog Recording URL'] = _posthog.get_session_replay_url({ withTimestamp: true })
                }

                const exceptions = event.exception?.values || []

                const data: SentryExceptionProperties & {
                    // two properties added to match any exception auto-capture
                    // added manually to avoid any dependency on the lazily loaded content
                    $exception_message: any
                    $exception_type: any
                    $exception_personURL: string
                } = {
                    // PostHog Exception Properties,
                    $exception_message: exceptions[0]?.value,
                    $exception_type: exceptions[0]?.type,
                    $exception_personURL: personUrl,
                    // Sentry Exception Properties
                    $sentry_event_id: event.event_id,
                    $sentry_exception: event.exception,
                    $sentry_exception_message: exceptions[0]?.value,
                    $sentry_exception_type: exceptions[0]?.type,
                    $sentry_tags: event.tags,
                }

                if (organization && projectId)
                    data['$sentry_url'] =
                        (prefix || 'https://sentry.io/organizations/') +
                        organization +
                        '/issues/?project=' +
                        projectId +
                        '&query=' +
                        event.event_id
                _posthog.capture('$exception', data)
                return event
            })
        }
    }
}
