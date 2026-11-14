const EventEmitter = require('events');

/**
 * In-process integration event bus for Module 1 -> Module 2 handoff.
 * Future queue/worker adapters (BullMQ, SQS, etc.) can subscribe here
 * without modifying Module 1 controllers or services.
 */
class IntakeEventBus extends EventEmitter {}

const intakeEventBus = new IntakeEventBus();

const INTAKE_EVENTS = Object.freeze({
  INTERVIEW_INTAKE_SUBMITTED: 'INTERVIEW_INTAKE_SUBMITTED',
});

/**
 * Build and emit the canonical Module 1 -> Module 2 integration payload.
 * @param {object} payload
 * @returns {object}
 */
const emitIntakeSubmitted = ({
  intakeId,
  candidateProfileId,
  resumeDocumentId,
  targetJobProfileId,
  jobDescriptionDocumentId = null,
  submittedAt,
}) => {
  const eventPayload = {
    event: INTAKE_EVENTS.INTERVIEW_INTAKE_SUBMITTED,
    intakeId: String(intakeId),
    candidateProfileId: String(candidateProfileId),
    resumeDocumentId: String(resumeDocumentId),
    targetJobProfileId: String(targetJobProfileId),
    jobDescriptionDocumentId: jobDescriptionDocumentId ? String(jobDescriptionDocumentId) : null,
    submittedAt: submittedAt instanceof Date ? submittedAt.toISOString() : submittedAt,
  };

  intakeEventBus.emit(INTAKE_EVENTS.INTERVIEW_INTAKE_SUBMITTED, eventPayload);
  return eventPayload;
};

module.exports = {
  intakeEventBus,
  INTAKE_EVENTS,
  emitIntakeSubmitted,
};
