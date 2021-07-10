import initialState from './initialState';
import { reducer as fetchPoolDataReducer } from './fetchPoolData';
import { reducer as fetchBalanceReducer } from './fetchBalance';
import { reducer as fetchCurrentlyStakedReducer } from './fetchCurrentlyStaked';
import { reducer as fetchRewardsAvailableReducer } from './fetchRewardsAvailable';
import { reducer as fetchCanWithdrawTimeReducer } from './fetchCanWithdrawTime';
import { reducer as fetchApprovalReducer } from './fetchApproval';
import { reducer as fetchStakeReducer } from './fetchStake';
import { reducer as fetchWithdrawReducer } from './fetchWithdraw';
import { reducer as fetchClaimReducer } from './fetchClaim';
import { reducer as fetchExitReducer } from './fetchExit';
import { reducer as subscriptionReducer } from './subscription';

const reducers = [
  fetchPoolDataReducer,
  fetchBalanceReducer,
  fetchCurrentlyStakedReducer,
  fetchRewardsAvailableReducer,
  fetchCanWithdrawTimeReducer,
  fetchApprovalReducer,
  fetchStakeReducer,
  fetchWithdrawReducer,
  fetchClaimReducer,
  fetchExitReducer,
  subscriptionReducer,
];

export default function reducer(state = initialState, action) {
  let newState;
  switch (action.type) {
    // Handle cross-topic actions here
    default:
      newState = state;
      break;
  }
  /* istanbul ignore next */
  return reducers.reduce((s, r) => r(s, action), newState);
}
