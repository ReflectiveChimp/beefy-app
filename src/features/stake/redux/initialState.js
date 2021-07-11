import { launchpools } from '../../helpers/getNetworkData';

const initialState = {
  fetchApprovalPending: Object.fromEntries(
    Object.values(launchpools).map(pool => [pool.id, false])
  ),
  fetchStakePending: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, false])),
  fetchWithdrawPending: Object.fromEntries(
    Object.values(launchpools).map(pool => [pool.id, false])
  ),
  fetchClaimPending: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, false])),
  fetchExitPending: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, false])),
  subscriptions: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, {}])),
  userApproval: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, '0'])),
  userBalance: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, '0'])),
  userStaked: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, '0'])),
  userRewardsAvailable: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, '0'])),
  poolStatus: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, pool.status])),
  poolFinish: Object.fromEntries(
    Object.values(launchpools).map(pool => [pool.id, pool.periodFinish])
  ),
  poolStaked: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, '0'])),
  poolApr: Object.fromEntries(Object.values(launchpools).map(pool => [pool.id, 0])),
};

export default initialState;
