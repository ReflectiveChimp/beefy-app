import { getNetworkStakePools } from '../../helpers/getNetworkData';

const pools = getNetworkStakePools();
let poolsInfo = [];
const poolData = [];
const initPoolsInfo = () => {
  for (let key in pools) {
    poolData.push({
      id: pools[key].id,
      name: pools[key].name,
      staked: 0,
      tvl: 0,
      apy: 0,
    });
  }
  poolsInfo = poolData;
};

initPoolsInfo();

const allowance = [0, 0, 0, 0, 0];
const balance = [0, 0, 0, 0, 0];
const currentlyStaked = [0, 0, 0, 0, 0];
const rewardsAvailable = [0, 0, 0, 0, 0];
const halfTime = [];
const canWithdrawTime = [0, 0, 0, 0, 0];

const initialState = {
  pools,
  allowance,
  currentlyStaked,
  rewardsAvailable,
  halfTime,
  canWithdrawTime,
  balance,
  poolsInfo,
  poolData,
  fetchPoolDataPending: [false],
  checkApprovalPending: [false, false, false, false, false],
  fetchBalancePending: [false, false, false, false, false],
  fetchCurrentlyStakedPending: [false, false, false, false, false],
  fetchRewardsAvailablePending: [false, false, false, false, false],
  fetchCanWithdrawTimePending: [false, false, false, false, false],
  fetchApprovalPending: Object.fromEntries(pools.map(pool => [pool.id, false])),
  fetchStakePending: Object.fromEntries(pools.map(pool => [pool.id, false])),
  fetchWithdrawPending: Object.fromEntries(pools.map(pool => [pool.id, false])),
  fetchClaimPending: Object.fromEntries(pools.map(pool => [pool.id, false])),
  fetchExitPending: Object.fromEntries(pools.map(pool => [pool.id, false])),
  subscriptions: Object.fromEntries(pools.map(pool => [pool.id, {}])),
  userApproval: Object.fromEntries(pools.map(pool => [pool.id, '0'])),
  userBalance: Object.fromEntries(pools.map(pool => [pool.id, '0'])),
  userStaked: Object.fromEntries(pools.map(pool => [pool.id, '0'])),
  userRewardsAvailable: Object.fromEntries(pools.map(pool => [pool.id, '0'])),
  poolStatus: Object.fromEntries(pools.map(pool => [pool.id, pool.status])),
  poolFinish: Object.fromEntries(pools.map(pool => [pool.id, pool.periodFinish])),
  poolStaked: Object.fromEntries(pools.map(pool => [pool.id, '0'])),
};

export default initialState;
