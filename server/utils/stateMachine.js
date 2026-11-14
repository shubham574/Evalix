const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Create a pure, framework- and database-independent finite state machine.
 * Validates the entire transition graph at creation time.
 */
const createStateMachine = ({ name, transitions, terminalStates = [] }) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('StateMachine requires a non-empty string name');
  }
  if (!isPlainObject(transitions) || Object.keys(transitions).length === 0) {
    throw new Error(`StateMachine '${name}' requires a non-empty transitions map`);
  }

  const stateNames = Object.keys(transitions);
  const stateSet = new Set(stateNames);

  for (const fromState of stateNames) {
    const targets = transitions[fromState];
    if (!Array.isArray(targets)) {
      throw new Error(
        `StateMachine '${name}' transitions['${fromState}'] must be an array of target states`
      );
    }
    for (const toState of targets) {
      if (typeof toState !== 'string' || !stateSet.has(toState)) {
        throw new Error(
          `StateMachine '${name}' references unknown target state '${String(toState)}' from '${fromState}'`
        );
      }
    }
  }

  if (!Array.isArray(terminalStates) && !(terminalStates instanceof Set)) {
    throw new Error(`StateMachine '${name}' terminalStates must be an array or Set`);
  }

  const terminalSet = new Set(terminalStates);
  for (const termState of terminalSet) {
    if (!stateSet.has(termState)) {
      throw new Error(
        `StateMachine '${name}' terminalStates contains unknown state '${String(termState)}'`
      );
    }
    if (transitions[termState].length > 0) {
      throw new Error(
        `StateMachine '${name}' terminal state '${termState}' must not define outgoing transitions`
      );
    }
  }

  const frozenTransitions = {};
  for (const state of stateNames) {
    frozenTransitions[state] = Object.freeze([...new Set(transitions[state])]);
  }
  Object.freeze(frozenTransitions);

  const hasState = (state) => typeof state === 'string' && stateSet.has(state);

  const isTerminal = (state) => hasState(state) && terminalSet.has(state);

  const getNextStates = (fromState) => {
    if (!hasState(fromState)) {
      const err = new Error(`StateMachine '${name}': unknown state '${String(fromState)}'`);
      err.code = 'UNKNOWN_STATE';
      err.statusCode = 400;
      throw err;
    }
    return frozenTransitions[fromState];
  };

  const canTransition = (fromState, toState) => {
    if (!hasState(fromState) || !hasState(toState)) return false;
    if (terminalSet.has(fromState)) return false;
    return frozenTransitions[fromState].includes(toState);
  };

  const assertTransition = (fromState, toState) => {
    if (!hasState(fromState)) {
      const err = new Error(`StateMachine '${name}': unknown source state '${String(fromState)}'`);
      err.code = 'UNKNOWN_STATE';
      err.statusCode = 400;
      throw err;
    }
    if (!hasState(toState)) {
      const err = new Error(`StateMachine '${name}': unknown target state '${String(toState)}'`);
      err.code = 'UNKNOWN_STATE';
      err.statusCode = 400;
      throw err;
    }
    if (!canTransition(fromState, toState)) {
      const reason = terminalSet.has(fromState)
        ? `cannot transition out of terminal state '${fromState}'`
        : `transition from '${fromState}' to '${toState}' is not allowed`;
      const err = new Error(`StateMachine '${name}': ${reason}`);
      err.code = 'INVALID_STATE_TRANSITION';
      err.statusCode = 409;
      err.fromState = fromState;
      err.toState = toState;
      throw err;
    }
    return true;
  };

  return Object.freeze({
    name,
    states: Object.freeze([...stateNames]),
    transitions: frozenTransitions,
    terminalStates: Object.freeze([...terminalSet]),
    hasState,
    isTerminal,
    getNextStates,
    canTransition,
    assertTransition,
  });
};

module.exports = {
  createStateMachine,
};
