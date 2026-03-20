<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="proposal-date__item">
		<div class="proposal-date__icon">
			<ItemIcon />
		</div>
		<div class="proposal-date__content" @click="$emit('dateFocus')">
			{{ formattedDate }}
		</div>
		<div class="proposal-date__action">
			<DestroyIcon
				:title="t('calendar', 'Remove date')"
				@click="$emit('dateRemove')" />
		</div>
	</div>
</template>

<script lang="ts">
import type { ProposalDateInterface } from '@/types/proposals/proposalInterfaces'

// types, object and stores
import { t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
// icons
import ItemIcon from 'vue-material-design-icons/Calendar'
import DestroyIcon from 'vue-material-design-icons/Close'

export default {
    name: 'ProposalDateItem',

    components: {
        ItemIcon,
        DestroyIcon,
    },

    props: {
        proposalDate: {
            type: Object as () => ProposalDateInterface,
            required: true,
        },

        timezoneId: {
            type: String,
            default: 'UTC',
        },
    },

    emits: ['dateRemove', 'dateFocus'],

    computed: {
        formattedDate(): string {
            if (!this.proposalDate.date) {
                return '';
            }

            let timezoneOffset = 0;

            try {
                const targetDate = new Date(this.proposalDate.date);

                // Formatters
                const tzFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: this.timezoneId,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                });

                const utcFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'UTC',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                });

                // Convert parts → ISO
                const partsToISO = (parts: Intl.DateTimeFormatPart[]) => {
                    const map: Record<string, string> = {};
                    for (const p of parts) map[p.type] = p.value;
                    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`;
                };

                const tzISO = partsToISO(tzFormatter.formatToParts(targetDate));
                const utcISO = partsToISO(utcFormatter.formatToParts(targetDate));

                const localAtTz = new Date(tzISO);
                const utcAtTz = new Date(utcISO);

                timezoneOffset = Math.round((localAtTz.getTime() - utcAtTz.getTime()) / (1000 * 60));
            } catch (e) {
                timezoneOffset = 0;
            }

            // Apply offset
            const m = moment(this.proposalDate.date).utcOffset(timezoneOffset);

            return m.format('dddd, MMMM D, LT');
        },
    },

    methods: {
        t,
    },
};
</script>

<style lang="scss" scoped>
.proposal-date__item {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline) * 4);
	padding: var(--default-grid-baseline);
    transition: background-color 0.2s ease;

	&:hover {
		background-color: var(--color-background-hover);
	}
}

.proposal-date__icon {
	flex-shrink: 0;
}

.proposal-date__content {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
}

.proposal-date__action {
	flex-shrink: 0;
}
</style>
