export interface WorkflowActionAvailability {
  supported: boolean;
  premiumLocked: boolean;
  statusLabel?: string;
}

export const WORKFLOW_ACTION_AVAILABILITY: Record<string, WorkflowActionAvailability> = {
  send_email: {
    supported: true,
    premiumLocked: false,
  },
  send_slack: {
    supported: true,
    premiumLocked: false,
  },
  send_sms: {
    supported: false,
    premiumLocked: true,
    statusLabel: 'Coming Soon',
  },
  http_request: {
    supported: true,
    premiumLocked: false,
  },
  create_task: {
    supported: false,
    premiumLocked: true,
    statusLabel: 'Coming Soon',
  },
  add_to_list: {
    supported: false,
    premiumLocked: true,
    statusLabel: 'Coming Soon',
  },
  delay: {
    supported: true,
    premiumLocked: false,
  },
  conditional: {
    supported: true,
    premiumLocked: false,
  },
};

export const PREMIUM_LOCKED_STEP_TYPES = Object.entries(WORKFLOW_ACTION_AVAILABILITY)
  .filter(([, availability]) => availability.premiumLocked)
  .map(([stepType]) => stepType);

export function getWorkflowActionAvailability(stepType: string): WorkflowActionAvailability {
  return WORKFLOW_ACTION_AVAILABILITY[stepType] ?? {
    supported: true,
    premiumLocked: false,
  };
}

export function isPremiumLockedAction(stepType: string): boolean {
  return getWorkflowActionAvailability(stepType).premiumLocked;
}

export function getPremiumLockedStepMessage(stepName: string, stepType: string): string {
  const availability = getWorkflowActionAvailability(stepType);
  const statusLabel = availability.statusLabel ?? 'Coming Soon';
  return `Step '${stepName}' uses '${stepType}', which is a Premium ${statusLabel.toLowerCase()} action and is not yet executable.`;
}

export function findPremiumLockedSteps(
  steps: Array<{ name?: string; type?: string }>
): string[] {
  return steps
    .filter((step) => step.type && isPremiumLockedAction(step.type))
    .map((step) => getPremiumLockedStepMessage(step.name || step.type || 'Unnamed step', step.type!));
}
