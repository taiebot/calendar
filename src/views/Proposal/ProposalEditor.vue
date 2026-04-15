<!--
  - SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
    <div>
        <NcModal
            v-if="modalVisible"
            class="proposal-modal__content"
            :name="modalTitle"
            :title="modalTitle"
            :size="modalSize"
            @close="onModalClose()">

            <!-- VIEW MODE -->
            <div v-if="modalMode === 'view'" class="proposal-viewer__content">
                <div class="proposal-viewer__content-title">
                    {{ selectedProposal?.title }}
                </div>
                <div class="proposal-viewer__content-description">
                    {{ selectedProposal?.description || t('calendar', 'No Description') }}
                </div>
                <div class="proposal-viewer__content-location">
                    <LocationIcon />
                    {{ selectedProposal?.location || t('calendar', 'No Location') }}
                </div>

                <div class="proposal-viewer__content-details">
                    <div class="proposal-viewer__content-duration-and-actions">
                        <div class="proposal-viewer__content-duration">
                            <DurationIcon />
                            {{ selectedProposal?.duration ? selectedProposal.duration + ' min' : '-' }}
                        </div>

                        <div class="proposal-viewer__content-actions">
                            <NcButton
                                variant="tertiary"
                                :title="t('calendar', 'Edit this meeting proposal')"
                                @click="onProposalModify()">
                                <template #icon><EditIcon /></template>
                                {{ t('calendar', 'Edit') }}
                            </NcButton>

                            <NcButton
                                variant="tertiary"
                                :title="t('calendar', 'Delete this meeting proposal')"
                                @click="onProposalDestroy(selectedProposal)">
                                <template #icon><DeleteIcon /></template>
                                {{ t('calendar', 'Delete') }}
                            </NcButton>
                        </div>
                    </div>
                </div>

                <div v-if="selectedProposal" class="proposal-viewer__content-matrix">
                    <ProposalResponseMatrix
                        mode="organizer"
                        :proposal="selectedProposal"
                        :timezoneId="userTimezone"
                        @dateConvert="onProposalConvert" />
                </div>
            </div>

            <!-- EDIT / CREATE MODE -->
            <div v-if="modalMode === 'create' || modalMode === 'modify'" class="proposal-editor__content">
                <div class="proposal-editor__column-left">

					<!-- CalendarPicker -->
					<CalendarPickerHeader
						:value="selectedCalendar"
						:calendars="userCalendars"
						:isReadOnly="false"
						:isViewedByAttendee="false"
						@update:value="onCalendarSelect" />

                    <!-- Title -->
                    <div class="proposal-editor__row-title">
                        <h2>{{ modalEditLabel }}</h2>
                    </div>

                    <!-- Details -->
                    <div class="proposal-editor__row-details">

                        <NcTextField
                            v-model="selectedProposal.title"
                            class="proposal-editor__proposal-title"
                            :label="t('calendar', 'Title')" />

                        <NcTextArea
                            v-model="selectedProposal.description"
                            class="proposal-editor__proposal-description"
                            :label="t('calendar', 'Description')" />

                        <!-- Location -->
                        <div class="proposal-editor__proposal-location-container">
                            <NcTextField
                                v-if="!settingsStore.talkEnabled || !modalEditLocationState"
                                class="proposal-editor__proposal-location"
                                :label="t('calendar', 'Location')"
                                :modelValue="selectedProposal.location" />

                            <NcCheckboxRadioSwitch
                                v-if="settingsStore.talkEnabled"
                                class="proposal-editor__proposal-location-selector"
                                variant="secondary"
                                :modelValue="modalEditLocationState"
                                @update:modelValue="onProposalLocationTypeToggle">
                                {{ t('calendar', 'Add Talk conversation') }}
                            </NcCheckboxRadioSwitch>
                        </div>

                        <!-- Duration -->
                        <div class="proposal-editor__proposal-duration-container">
                            <NcTextField
                                v-model="selectedProposal.duration"
                                class="proposal-editor__proposal-duration"
                                :label="t('calendar', 'Duration')"
                                type="number"
                                min="1"
                                step="1"
                                @input="onProposalDurationChange($event)" />

                            <NcRadioGroup
                                v-model="selectedProposal.duration"
                                class="proposal-editor__proposal-duration-helpers"
                                :label="t('calendar', 'Duration suggestions')"
                                hideLabel
                                @update:modelValue="onProposalDurationSuggestionChange">
                                <NcRadioGroupButton
                                    v-for="duration in [15, 30, 60, 90]"
                                    :key="duration"
                                    :label="t('calendar', '{duration} min', { duration })"
                                    :value="duration" />
                            </NcRadioGroup>
                        </div>

                        <!-- Participants -->
                        <InviteesListSearch
                            class="proposal-editor__proposal-participants-selector"
                            :alreadyInvitedEmails="existingParticipantAddressess"
                            @addAttendee="onProposalParticipantAdd" />

                        <div v-if="selectedProposal.participants.length > 0" class="proposal-editor__proposal-participants">
                            <h6>{{ t('calendar', 'Participants') }}</h6>
                            <ProposalParticipantItem
                                v-for="(participant, idx) in selectedProposal.participants"
                                :key="idx"
                                :proposalParticipant="participant"
                                @participantAttendance="onProposalParticipantAttendance(participant.address, $event)"
                                @participantRemove="onProposalParticipantRemove(participant.address)" />
                        </div>

                        <!-- Dates -->
                        <div v-if="selectedProposal.dates.length > 0" class="proposal-editor__proposed-dates">
                            <h6>{{ t('calendar', 'Selected times') }}</h6>
                            <ProposalDateItem
                                v-for="(entry, idx) in selectedProposal.dates"
                                :key="idx"
                                :proposalDate="entry"
                                :timezoneId="userTimezone"
                                @dateFocus="onProposalDateFocus(entry)"
                                @dateRemove="onProposalDateRemove(idx)" />
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="proposal-editor__row-actions">
                        <NcButton
                            class="proposal-editor__save-button"
                            variant="primary"
                            :disabled="!modalEditSaveState"
                            @click="onProposalSave()">
                            {{ modalEditSaveLabel }}
                        </NcButton>

                        <NcButton
                            v-if="modalEditDestroyState"
                            variant="secondary"
                            @click="onProposalDestroy(selectedProposal)">
                            Delete
                        </NcButton>
                    </div>
                </div>

                <!-- Calendar preview -->
                <div class="proposal-editor__column-right">
                    <div class="proposal-editor__calendar-actions">
                        <NcButton variant="secondary" @click="onCalendarFocusToday()">
                            {{ t('calendar', 'Today') }}
                        </NcButton>

                        <NcButton variant="secondary" @click="onCalendarSpanPrevious()">
                            <template #icon><PreviousSpanIcon /></template>
                        </NcButton>

                        <NcButton variant="secondary" @click="onCalendarSpanNext()">
                            <template #icon><NextSpanIcon /></template>
                        </NcButton>

                        <h2>{{ calendarDateRange }}</h2>

                        <NcButton variant="secondary" @click="onCalendarSpanIncrease()">
                            <template #icon><ZoomInIcon /></template>
                        </NcButton>

                        <NcButton variant="secondary" @click="onCalendarSpanDecrease()">
                            <template #icon><ZoomOutIcon /></template>
                        </NcButton>
                    </div>

                    <FullCalendar
                        ref="proposalFullCalendar"
                        :options="calendarConfiguration"
                        class="proposal-editor__calendar" />
                </div>
            </div>
        </NcModal>

        <!-- DELETE DIALOG -->
        <NcDialog
            :open="showDeleteDialog"
            :name="t('calendar', 'Delete proposal')"
            :message="deleteDialogMessage"
            :buttons="deleteDialogButtons"
            @update:open="showDeleteDialog = $event" />

        <!-- CONVERT DIALOG (cleaned) -->
        <NcDialog
            :open="showConvertDialog"
            :name="t('calendar', 'Create meeting')"
            :message="convertDialogMessage"
            :buttons="convertDialogButtons"
            @update:open="showConvertDialog = $event" />
    </div>
</template>

<script lang="ts">
import type { Proposal } from '@/models/proposals/proposals'

import FullCalendarInteraction from '@fullcalendar/interaction'
import FullCalendarTimeGrid from '@fullcalendar/timegrid'
import FullCalendar from '@fullcalendar/vue3'
import { AttendeeProperty } from '@nextcloud/calendar-js'
import { showError, showSuccess } from '@nextcloud/dialogs'
import { t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import PreviousSpanIcon from 'vue-material-design-icons/ChevronLeft'
import NextSpanIcon from 'vue-material-design-icons/ChevronRight'
import DurationIcon from 'vue-material-design-icons/ClockOutline'
import ZoomOutIcon from 'vue-material-design-icons/MagnifyMinusOutline'
// icons
import ZoomInIcon from 'vue-material-design-icons/MagnifyPlusOutline'
import LocationIcon from 'vue-material-design-icons/MapMarkerOutline'
import EditIcon from 'vue-material-design-icons/PencilOutline'
import DeleteIcon from 'vue-material-design-icons/TrashCanOutline'
// components
import CalendarPickerHeader from '../../components/Editor/CalendarPickerHeader.vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcModal from '@nextcloud/vue/components/NcModal'
import NcRadioGroup from '@nextcloud/vue/components/NcRadioGroup'
import NcRadioGroupButton from '@nextcloud/vue/components/NcRadioGroupButton'
import NcTextArea from '@nextcloud/vue/components/NcTextArea'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import InviteesListSearch from '@/components/Editor/Invitees/InviteesListSearch.vue'
import ProposalDateItem from '@/components/Proposal/ProposalDateItem.vue'
import ProposalParticipantItem from '@/components/Proposal/ProposalParticipantItem.vue'
import ProposalResponseMatrix from '@/components/Proposal/ProposalResponseMatrix.vue'
import { getBusySlots } from '../../services/freeBusySlotService.js'
import FullCalendarMoment from '@/fullcalendar/localization/momentPlugin.js'
import FullCalendarTimezones from '@/fullcalendar/timezones/vtimezoneNamedTimezoneImpl.js'
import { ProposalDate, ProposalParticipant } from '@/models/proposals/proposals'
// types, object and stores
import usePrincipalStore from '@/store/principals.js'
import useProposalStore from '@/store/proposalStore'
import useSettingsStore from '@/store/settings.js'
import { ProposalDateVote, ProposalParticipantAttendance, ProposalParticipantRealm, ProposalParticipantStatus } from '@/types/proposals/proposalEnums'

// Helper interface for participants emitted by InviteesListSearch
interface ParticipantSearchInterface {
	calendarUserType: 'INDIVIDUAL' | 'GROUP'
	email: string
	commonName?: string
	isUser?: boolean
}

// Helper interface for busy slots of a participant generated by getBusySlots
interface ParticipantBusySlotInterface {
	id: string
	resourceId: string
	start: string | Date
	end: string | Date
	[key: string]: unknown
}

export default {
	name: 'ProposalEditor',

	components: {
		CalendarPickerHeader,
		NcButton,
		NcCheckboxRadioSwitch,
		NcDialog,
		NcModal,
		NcRadioGroup,
		NcRadioGroupButton,
		NcSelect,
		NcTextField,
		NcTextArea,
		FullCalendar,
		InviteesListSearch,
		ProposalParticipantItem,
		ProposalDateItem,
		ProposalResponseMatrix,
		ZoomInIcon,
		ZoomOutIcon,
		PreviousSpanIcon,
		NextSpanIcon,
		EditIcon,
		DeleteIcon,
		LocationIcon,
		DurationIcon,
	},

	data() {
		return {
			principalStore: usePrincipalStore(),
			settingsStore: useSettingsStore(),
			proposalStore: useProposalStore(),
			ProposalParticipantAttendance,
			ProposalParticipantStatus,
			ProposalDateVote,
			modalMode: 'view',
			calendarApi: null as unknown, // FullCalendar API instance
			selectedProposal: null as Proposal | null,
			participantAvailability: {} as Record<string, Record<string, ParticipantBusySlotInterface[]>>, // availability per participant
			participantColors: {} as Record<string, string>,
			calendarColumnWidth: 120, // Current pixel width allocated per day column
			calendarColumnWidthMin: 80, // Minimum day column width
			calendarColumnWidthStep: 40, // Pixel change per zoom action
			calendarSpanMax: 28, // Maximum days that can be shown
			calendarSpanMin: 1, // Minimum days that can be shown
			calendarSpanDays: 7, // Currently applied span (derived)
			screenWidth: window.innerWidth, // Track screen width
			showDeleteDialog: false,
			pendingDeleteProposal: null as Proposal | null,
			showConvertDialog: false,
			pendingConvertDate: null as ProposalDate | null,
			userCalendars: [] as Array<{ uri: string, displayName: string }>,
			selectedCalendarUri: null as string | null,	
		}
	},

	computed: {

		selectedCalendar() {
        	return this.userCalendars.find(c => c.uri === this.selectedCalendarUri) || this.userCalendars[0]
    	},

		userTimezone(): string {
			return this.settingsStore?.getResolvedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
		},

		modalVisible(): boolean {
			return this.proposalStore.modalVisible
		},

		modalSize(): string {
			if (this.modalMode === 'view') {
				return 'normal'
			} else {
				return 'full'
			}
		},

		modalTitle(): string {
			switch (this.modalMode) {
				case 'view':
					return t('calendar', 'Meeting proposals overview')
				case 'modify':
					return t('calendar', 'Edit meeting proposal')
				default:
					return t('calendar', 'Create meeting proposal')
			}
		},

		modalEditLabel(): string {
			return !this.selectedProposal || this.selectedProposal.id ? t('calendar', 'Update meeting proposal') : t('calendar', 'Create meeting proposal')
		},

		modalEditSaveLabel(): string {
			return !this.selectedProposal || this.selectedProposal.id ? t('calendar', 'Update') : t('calendar', 'Create')
		},

		modalEditSaveState(): boolean {
			if (!this.selectedProposal) {
				// disable if no proposal selected
				return false
			}
			return (
				this.selectedProposal.title !== null
				&& this.selectedProposal.duration > 0
				&& this.selectedProposal.participants.length > 0
				&& this.selectedProposal.dates.length > 0
			)
		},

		modalEditDestroyState(): boolean {
			return !this.selectedProposal || this.selectedProposal.id !== null
		},

		modalEditLocationState(): boolean {
			if (!this.selectedProposal) {
				return false
			}
			if (this.selectedProposal.location === 'Talk conversation') {
				return true
			} else {
				return false
			}
		},

		/**
		 * Configuration options for FullCalendar
		 * Please see https://fullcalendar.io/docs#toc for details
		 *
		 * @return
		 */
		calendarConfiguration() {
			const today = new Date()
			today.setHours(0, 0, 0, 0)

			return {
				plugins: [
					FullCalendarTimeGrid,
					FullCalendarInteraction,
					FullCalendarMoment,
					FullCalendarTimezones,
				],

				headerToolbar: false,
				initialView: 'timeGridSpan',
				views: {
					timeGridSpan: {
						type: 'timeGrid',
						duration: { days: this.calendarSpanDays },
					},
				},

				dayHeaderFormat: { weekday: 'short', day: 'numeric' },
				allDaySlot: false,
				timeZone: this.userTimezone,
				slotDuration: '00:15:00',
				validRange: {
					start: today,
				},

				nowIndicator: true,
				eventOverlap: true,
				eventOrderStrict: true,
				eventOrder: 'duration,title',
				selectable: true,
				selectMirror: true,
				select: (info: unknown) => this.onProposalDateAdd(info),
				eventDrop: (info: unknown) => this.onProposalDateMove(info),
				datesSet: () => {
					if (!this.modalVisible) {
						return
					}
					// Initialize calendar API when the calendar view is ready
					this.initializeCalendar()
					if (!this.calendarApi) {
						return
					}
					this.fetchParticipantAvailability()
				},
			}
		},

		pendingConvertDateString(): string {
			return this.pendingConvertDate ? this.formatProposalDate(this.pendingConvertDate.date) : ''
		},

		deleteDialogMessage(): string {
			const title = this.pendingDeleteProposal?.title ?? t('calendar', 'No title')
			return t('calendar', 'Are you sure you want to delete "{title}"?', { title })
		},

		convertDialogMessage(): string {
			return t('calendar', 'Create a meeting for "{date}"? This will create a calendar event with all participants.', { date: this.pendingConvertDateString })
		},

		deleteDialogButtons() {
			return [
				{
					label: t('calendar', 'Delete'),
					variant: 'secondary',
					callback: () => this.destroyProposal(),
				},
				{
					label: t('calendar', 'Cancel'),
					variant: 'primary',
					callback: () => { this.showDeleteDialog = false },
				},
			]
		},
