<script setup lang="ts">
import { useGamepad } from '../input/useGamepad'

defineProps<{ k: string }>()

const mode = useGamepad().mode
</script>

<template>
  <span v-if="mode" class="gp-key">{{ k }}</span>
</template>
