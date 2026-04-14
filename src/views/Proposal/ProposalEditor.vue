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
			<!-- Show proposal viewer -->
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
								<template #icon>
									<EditIcon />
								</template>
								{{ t('calendar', 'Edit') }}
							</NcButton>
							<NcButton
								variant="tertiary"
								:title="t('calendar', 'Delete this meeting proposal')"
								@click="onProposalDestroy(selectedProposal)">
								<template #icon>
									<DeleteIcon />
								</template>
								{{ t('calendar', 'Delete') }}
							</NcButton>
						</div>
					</div>
				</div>
				<!-- Responses Matrix Row -->
				<div v-if="selectedProposal" class="proposal-viewer__content-matrix">
					<ProposalResponseMatrix
						mode="organizer"
						:proposal="selectedProposal"
						:timezoneId="userTimezone"
						@dateConvert="onProposalConvert" />
				</div>
			</div>
			<!-- Show proposal editor -->
			<div v-if="modalMode === 'create' || modalMode === 'modify'" class="proposal-editor__content">
				<div class="proposal-editor__column-left">
					<!-- Row 1: Title -->
					<div class="proposal-editor__row-title">
						<h2>{{ modalEditLabel }}</h2>
					</div>
					<!-- Row 2: Details -->
					<div class="proposal-editor__row-details">
						<NcTextField
							v-model="selectedProposal.title"
							class="proposal-editor__proposal-title"
							:label="t('calendar', 'Title')" />
						<NcTextArea
							v-model="selectedProposal.description"
							class="proposal-editor__proposal-description"
							:label="t('calendar', 'Description')" />
						<NcSelect
							v-if="userCalendars.length"
							v-model="selectedCalendarUri"
							:options="userCalendars.map(c => ({ value: c.uri, label: c.displayName }))"
							:label="t('calendar', 'Select calendar')"/>
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
					<!-- Row 3: Actions -->
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
				<div class="proposal-editor__column-right">
					<div class="proposal-editor__calendar-actions">
						<NcButton variant="secondary" @click="onCalendarFocusToday()">
							{{ t('calendar', 'Today') }}
						</NcButton>
						<NcButton
							variant="secondary"
							:aria-label="t('calendar', 'Previous span')"
							@click="onCalendarSpanPrevious()">
							<template #icon>
								<PreviousSpanIcon />
							</template>
						</NcButton>
						<NcButton
							variant="secondary"
							:aria-label="t('calendar', 'Next span')"
							@click="onCalendarSpanNext()">
							<template #icon>
								<NextSpanIcon />
							</template>
						</NcButton>
						<h2>{{ calendarDateRange }}</h2>
						<NcButton
							variant="secondary"
							:aria-label="t('calendar', 'Less days')"
							@click="onCalendarSpanIncrease()">
							<template #icon>
								<ZoomInIcon />
							</template>
						</NcButton>
						<NcButton
							variant="secondary"
							:aria-label="t('calendar', 'More days')"
							@click="onCalendarSpanDecrease()">
							<template #icon>
								<ZoomOutIcon />
							</template>
						</NcButton>
					</div>
					<FullCalendar
						ref="proposalFullCalendar"
						:options="calendarConfiguration"
						class="proposal-editor__calendar" />
				</div>
			</div>
		</NcModal>

		<NcDialog
			:open="showDeleteDialog"
			:name="t('calendar', 'Delete proposal')"
			:message="deleteDialogMessage"
			:buttons="deleteDialogButtons"
			@update:open="showDeleteDialog = $event" />

		<NcDialog
			:open="showConvertDialog"
			:name="t('calendar', 'Create meeting')"
			:buttons="convertDialogButtons"
			@update:open="showConvertDialog = $event" 
		>

			<div style="display:flex; flex-direction:column; gap:12px;">
				<div>{{ convertDialogMessage }}</div>

				<NcSelect
					v-if="userCalendars.length"
					v-model="selectedCalendarUri"
					:options="userCalendars.map(c => ({ value: c.uri, label: c.displayName }))"
					:label="t('calendar', 'Select calendar')" />
			</div>
		</NcDialog>

	</div>
</template>
