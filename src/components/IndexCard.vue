<script setup lang="ts">
import { computed } from 'vue'
import type { IndexCardRow } from './types'

const props = defineProps<{
  rows: IndexCardRow[]
  flipped?: boolean
  swiped?: boolean
  fill?: boolean
}>()

const wrapperClasses = computed(() => [
  'card-wrap',
  'w-full',
  props.fill && 'h-full',
  props.flipped && 'card-flipped',
  props.swiped && 'card-swiped'
])

const textClass = (row: IndexCardRow) => {
  if (row.type === 'divider') return ''

  const classes: string[] = []

  if (row.size === 'small') {
    classes.push('text-lg', 'text-base-content/90')
  } else if (row.size === 'auto') {
    const length = row.text?.length ?? 0
    if (length < 3) classes.push('text-7xl', 'font-bold')
    else if (length < 20) classes.push('text-5xl', 'font-bold')
    else classes.push('text-3xl', 'font-semibold')
  } else {
    classes.push('text-xl')
  }

  if (row.highlight) {
    classes.push('bg-base-200/70', 'border', 'border-base-300/60', 'rounded', 'px-2')
  }

  return classes.join(' ')
}
</script>

<template>
  <div :class="wrapperClasses">
    <div class="card glass border border-base-200/60 shadow">
      <div class="card-body grid gap-4 place-items-center text-center text-base-content">
      <template
        v-for="(row, index) in rows"
        :key="index"
      >
        <div
          v-if="row.type === 'divider'"
          class="w-full border-b border-white/20"
        />
        <p
          v-else
          :class="textClass(row)"
          :dir="row.rtl ? 'rtl' : undefined"
          v-html="row.text"
        />
      </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .card-wrap {
    transform-style: preserve-3d;
    transition: transform 0.3s ease;
  }

.card-flipped {
  animation: flipCard 0.4s ease;
}

@keyframes flipCard {
  0% {
    transform: rotateY(0deg);
  }
  50% {
    transform: rotateY(90deg);
  }
  100% {
    transform: rotateY(0deg);
  }
}

.card-swiped {
  animation: swipeCard 0.35s ease forwards;
}

@keyframes swipeCard {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(60%);
    opacity: 0;
  }
}
</style>
