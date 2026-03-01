/**
 * SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { DateTimeValue } from '@nextcloud/calendar-js'
import { getCanonicalLocale, translate as t } from '@nextcloud/l10n'
import getTimezoneManager from '../../services/timezoneDataProviderService.js'
import useSettingsStore from '../../store/settings.js'
import { errorCatch } from '../utils/errors.js'
import { getDateFromDateTimeValue } from '@/utils/date.js'

/**
 * Convert a date from UTC to user's timezone
 *
 * @param {Date} date The date to convert (in UTC)
 * @return {Date} Converted date in user's timezone
 */
function convertToUserTimezone(date) {
	const settingsStore = useSettingsStore()
	const userTimezoneId = settingsStore.getResolvedTimezone

	const tzManager = getTimezoneManager()
	const utcTimezone = tzManager.getTimezoneForId('UTC')
	const userTimezone = tzManager.getTimezoneForId(userTimezoneId)

	const dateTimeValue = DateTimeValue.fromJSDate(date, true)
	dateTimeValue.replaceTimezone(utcTimezone)
	return getDateFromDateTimeValue(dateTimeValue.getInTimezone(userTimezone))
}

/**
 * Format a date with specified options
 *
 * @param {Date} date The date to format (in UTC for timed events, local for all-day)
 * @param {string} locale The locale to use
 * @param {object} options Formatting options
 * @param {boolean} convertTimezone Whether to convert from UTC to user timezone
 * @return {string} Formatted date string
 */
function formatDate(date, locale, options, convertTimezone = false) {
	const dateToFormat = convertTimezone ? convertToUserTimezone(date) : date
	return dateToFormat.toLocaleString(locale, options)
}

/**
 * Check if an all-day event spans multiple days
 *
 * @param {Date} start Start date
 * @param {Date} end End date (exclusive in FullCalendar)
 * @return {boolean} True if multi-day
 */
function isMultiDayAllDayEvent(start, end) {
	// FullCalendar all-day end dates are exclusive, so subtract one day
	const adjustedEnd = new Date(end)
	adjustedEnd.setDate(adjustedEnd.getDate() - 1)
	adjustedEnd.setHours(0, 0, 0, 0)

	const startMidnight = new Date(start)
	startMidnight.setHours(0, 0, 0, 0)

	return adjustedEnd.getTime() > startMidnight.getTime()
}

/**
 * Build time description for all-day events
 *
 * @param {EventApi} event The event
 * @param {string} locale The locale to use
 * @return {string} Time description
 */
function buildAllDayTimeDescription(event, locale) {
	if (!event.start) {
		return ''
	}

	const dateOptions = {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	}
	const startStr = formatDate(event.start, locale, dateOptions)

	if (!event.end || !isMultiDayAllDayEvent(event.start, event.end)) {
		return startStr
	}

	// Multi-day event: calculate end date (exclusive, so subtract 1 day)
	const adjustedEnd = new Date(event.end)
	adjustedEnd.setDate(adjustedEnd.getDate() - 1)
	const endStr = formatDate(adjustedEnd, locale, dateOptions)

	return t('calendar', '{startDate} to {endDate}', {
		startDate: startStr,
		endDate: endStr,
	})
}

/**
 * Build time description for timed events
 *
 * @param {EventApi} event The event
 * @param {string} locale The locale to use
 * @return {string} Time description
 */
function buildTimedEventDescription(event, locale) {
	if (!event.start) {
		return ''
	}

	const dateTimeOptions = {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}
	const timeOptions = {
		hour: 'numeric',
		minute: 'numeric',
	}

	const startStr = formatDate(event.start, locale, dateTimeOptions, true)

	if (!event.end) {
		return startStr
	}

	// Check if same day - only show time for end
	const sameDay = event.start.toDateString() === event.end.toDateString()
	if (sameDay) {
		const endTimeStr = formatDate(event.end, locale, timeOptions, true)
		return t('calendar', '{startDateTime} to {endTime}', {
			startDateTime: startStr,
			endTime: endTimeStr,
		})
	}

	// Multi-day timed event
	const endStr = formatDate(event.end, locale, dateTimeOptions, true)
	return t('calendar', '{startDateTime} to {endDateTime}', {
		startDateTime: startStr,
		endDateTime: endStr,
	})
}

/**
 * Builds an accessible label for a calendar event including its title and time.
 *
 * @param {EventApi} event The fullcalendar event object
 * @return {string} A human-readable label for screen readers
 */
function buildAriaLabel(event) {
	const locale = getCanonicalLocale() || undefined
	const title = event.title || t('calendar', 'Untitled event')
	const parts = [title]

	if (event.allDay) {
		parts.push(t('calendar', 'All day'))
		const timeDescription = buildAllDayTimeDescription(event, locale)
		if (timeDescription) {
			parts.push(timeDescription)
		}
	} else {
		const timeDescription = buildTimedEventDescription(event, locale)
		if (timeDescription) {
			parts.push(timeDescription)
		}
	}

	return parts.join(', ')
}

/**
 * Adds data to the html element representing the event in the fullcalendar grid.
 * This is used to later on position the popover
 *
 * @param {object} data The destructuring object
 * @param {EventApi} data.event The fullcalendar event object
 * @param {Node} data.el The HTML element
 */
export default errorCatch(function({ event, el }) {
	// Set aria-label for screen reader accessibility
	el.setAttribute('aria-label', buildAriaLabel(event))
	if (el.classList.contains('fc-event-nc-alarms')) {
		const notificationIcon = document.createElement('span')
		notificationIcon.classList.add('icon-event-reminder')
		notificationIcon.setAttribute('aria-hidden', 'true')
		if (event.extendedProps.darkText) {
			notificationIcon.classList.add('icon-event-reminder--dark')
		} else {
			notificationIcon.classList.add('icon-event-reminder--light')
		}
		el.firstChild.appendChild(notificationIcon)
	}

	if (el.classList.contains('fc-event-nc-task')) {
		if (el.classList.contains('fc-list-event')) {
			// List view
			const dotElement = el.querySelector('.fc-list-event-dot')
			dotElement.classList.remove('fc-list-event-dot')
			dotElement.classList.add('fc-list-event-checkbox')
			dotElement.style.color = 'var(--color-main-text)'

			if (event.extendedProps.percent === 100) {
				dotElement.classList.add('calendar-grid-checkbox-checked')
			} else {
				dotElement.classList.add('calendar-grid-checkbox')
			}
		} else if (el.classList.contains('fc-daygrid-dot-event')) {
			// Dot event in day grid view
			const dotElement = el.querySelector('.fc-daygrid-event-dot')
			dotElement.classList.remove('fc-daygrid-event-dot')
			dotElement.classList.add('fc-daygrid-event-checkbox')
			dotElement.style.color = 'var(--color-main-text)'

			if (event.extendedProps.percent === 100) {
				dotElement.classList.add('calendar-grid-checkbox-checked')
			} else {
				dotElement.classList.add('calendar-grid-checkbox')
			}
		} else {
			// AgendaView and all-day grid view
			const titleContainer = el.querySelector('.fc-event-title-container')
			const checkboxElement = document.createElement('div')
			checkboxElement.classList.add('fc-event-title-checkbox')
			if (event.extendedProps.percent === 100) {
				checkboxElement.classList.add('calendar-grid-checkbox-checked')
			} else {
				checkboxElement.classList.add('calendar-grid-checkbox')
			}

			titleContainer.prepend(checkboxElement)
		}
	}

	if (event.source === null) {
		el.dataset.isNew = 'yes'
	} else {
		el.dataset.objectId = event.extendedProps.objectId
		el.dataset.recurrenceId = event.extendedProps.recurrenceId
	}

	if (el.classList.contains('fc-list-event')) {
		const locationContainer = document.createElement('td')
		locationContainer.classList.add('fc-list-event-location')
		const descriptionContainer = document.createElement('td')
		descriptionContainer.classList.add('fc-list-event-description')

		el.appendChild(locationContainer)
		el.appendChild(descriptionContainer)

		if (event.extendedProps.location) {
			const location = document.createElement('span')
			location.appendChild(document.createTextNode(event.extendedProps.location))
			locationContainer.appendChild(location)
		}

		if (event.extendedProps.description) {
			const description = document.createElement('span')
			description.appendChild(document.createTextNode(event.extendedProps.description))
			descriptionContainer.appendChild(description)
		}
	}

	if (
		el.classList.contains('fc-event-nc-all-declined')
		|| el.classList.contains('fc-event-nc-needs-action')
		|| el.classList.contains('fc-event-nc-declined')
	) {
		const titleElement = el.querySelector('.fc-event-title')
		const timeElement = el.querySelector('.fc-event-time')
		const dotElement = el.querySelector('.fc-daygrid-event-dot')

		if (dotElement) {
			dotElement.style.borderWidth = '2px'
			dotElement.style.background = 'var(--fc-page-bg-color)'
			dotElement.style.minWidth = '10px'
			dotElement.style.minHeight = '10px'
		} else {
			el.style.background = 'var(--fc-page-bg-color)'
		}

		if (titleElement) {
			titleElement.style.color = 'var(--color-main-text)'
		}

		if (timeElement) {
			timeElement.style.color = 'var(--color-main-text)'
		}

		el.title = t('calendar', 'All participants declined')

		if (el.classList.contains('fc-event-nc-needs-action')) {
			el.title = t('calendar', 'Please confirm your participation')
		}

		if (el.classList.contains('fc-event-nc-declined')) {
			el.title = t('calendar', 'You declined this event')
			if (titleElement) {
				titleElement.style.textDecoration = 'line-through'
			}
		}
	}

	if (el.classList.contains('fc-event-nc-all-declined')) {
		const titleElement = el.querySelector('.fc-event-title')

		if (titleElement) {
			const svgString = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="m40-120 440-760 440 760H40Zm440-120q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Z"/></svg>'
			titleElement.innerHTML = svgString + titleElement.innerHTML

			const svgElement = titleElement.querySelector('svg')
			if (svgElement) {
				svgElement.style.fill = el.style.borderColor
				svgElement.style.width = '1em'
				svgElement.style.marginBottom = '0.2em'
				svgElement.style.verticalAlign = 'middle'
			}
		}
	}

	if (el.classList.contains('fc-event-nc-tentative')) {
		const dotElement = el.querySelector('.fc-daygrid-event-dot')

		// Get background color, with fallback to border color if dotElement doesn't exist
		const bgColor = el.style.backgroundColor
			? el.style.backgroundColor
			: (dotElement ? dotElement.style.borderColor : el.style.borderColor)
		const bgStripeColor = darkenColor(bgColor)

		let backgroundStyling = `repeating-linear-gradient(45deg, ${bgStripeColor}, ${bgStripeColor} 1px, ${bgColor} 1px, ${bgColor} 10px)`

		if (dotElement) {
			dotElement.style.borderWidth = '2px'
			backgroundStyling = `repeating-linear-gradient(45deg, ${bgColor}, ${bgColor} 1px, var(--fc-page-bg-color) 1px, var(--fc-page-bg-color) 3.5px)`

			dotElement.style.background = backgroundStyling
			dotElement.style.minWidth = '10px'
			dotElement.style.minHeight = '10px'
		} else {
			el.style.background = backgroundStyling
		}

		el.title = t('calendar', 'Your participation is tentative')
	}
}, 'eventDidMount')

/**
 * Create a slightly darker color for background stripes
 *
 * @param {string} color The color to darken
 */
function darkenColor(color) {
	const rgb = color.match(/\d+/g)
	if (!rgb) {
		return color
	}
	const [r, g, b] = rgb.map((c) => Math.max(0, Math.min(255, c - (c * 0.3))))
	return `rgb(${r}, ${g}, ${b})`
}
