import { getNetworkMulticall, getNetworkStakePools } from '../../helpers/getNetworkData';
import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useMemo } from 'react';
import { MooToken } from '../../configure/abi';
import { MultiCall } from 'eth-multicall';
import Web3 from 'web3';
import { getRpcUrl } from '../../../common/networkSetup';
import { useConnectWallet } from '../../home/redux/connectWallet';
import { byDecimals } from '../../helpers/bignumber';

const DEFAULT_UPDATE_INTERVAL = 30000; // ms
const MIN_UPDATE_DELAY = 10000; // ms (min time between updates)
const ACTION_PREFIX = 'launchpools/subscription/';
const NOOP = () => {};

// launchpool data
const pools = getNetworkStakePools();
const poolsById = Object.fromEntries(pools.map(pool => [pool.id, pool]));

// what contact calls are needed to perform subscription actions
const subscriptionCalls = {
  userApproval: ['userApproval'],
  userBalance: ['userBalance'],
  userStaked: ['userStaked'],
  userRewardsAvailable: ['userRewardsAvailable'],
  poolApy: ['poolRewardRate', 'poolStaked', 'tokenPricePerShare'],
  poolStaked: ['poolStaked'],
  poolTvl: ['poolStaked'],
  poolFinish: ['poolFinish'],
};

// list of contract calls that do not require the users wallet address
const callsDoNotNeedAddress = ['poolRewardRate', 'poolStaked', 'poolFinish', 'tokenPricePerShare'];

// list of subscriptions that do not require the users wallet address
const subscriptionsDoNotNeedAddress = Object.fromEntries(
  Object.entries(subscriptionCalls).map(([key, calls]) => [
    key,
    calls.every(call => callsDoNotNeedAddress.includes(call)),
  ])
);

// which contract is needed to perform the call
const callGroups = {
  userApproval: 'tokenAddress',
  userBalance: 'tokenAddress',
  userStaked: 'earnContractAddress',
  userRewardsAvailable: 'earnContractAddress',
  poolRewardRate: 'earnContractAddress',
  poolStaked: 'earnContractAddress',
  poolFinish: 'earnContractAddress',
  tokenPricePerShare: 'tokenAddress',
};

// contract name -> instance of the contract
const callGroupContracts = {
  tokenAddress: (web3, pool) => new web3.eth.Contract(MooToken, pool.tokenAddress),
  earnContractAddress: (web3, pool) =>
    new web3.eth.Contract(pool.earnContractAbi, pool.earnContractAddress),
};

// call name -> contract method call
const callFunctions = {
  userApproval: (tokenContract, pool, address) =>
    tokenContract.methods.allowance(address, pool.earnContractAddress),
  userBalance: (tokenContract, pool, address) => tokenContract.methods.balanceOf(address),
  userStaked: (earnContract, pool, address) => earnContract.methods.balanceOf(address),
  userRewardsAvailable: (earnContract, pool, address) => earnContract.methods.earned(address),
  poolRewardRate: (earnContract, pool, address) => earnContract.methods.rewardRate(),
  poolStaked: (earnContract, pool, address) => earnContract.methods.totalSupply(),
  poolFinish: (earnContract, pool, address) => earnContract.methods.periodFinish(),
  tokenPricePerShare: (tokenContract, pool, address) =>
    tokenContract.methods.getPricePerFullShare(),
};

// process subscription and dispatch action to update state
// data will include call results with keys defined in subscriptionCalls above
// TODO clear user*** on wallet disconnect
const subscriptionCallbacks = {
  userApproval: async (dispatch, pool, data) => {
    // Save to state
    dispatch({
      type: ACTION_PREFIX + 'userApproval',
      payload: {
        id: pool.id,
        userApproval: data.userApproval,
      },
    });
  },
  userBalance: async (dispatch, pool, data) => {
    // Save to state
    dispatch({
      type: ACTION_PREFIX + 'userBalance',
      payload: {
        id: pool.id,
        userBalance: data.userBalance,
      },
    });
  },
  userStaked: async (dispatch, pool, data) => {
    // Save to state
    dispatch({
      type: ACTION_PREFIX + 'userStaked',
      payload: {
        id: pool.id,
        userStaked: data.userStaked,
      },
    });
  },
  userRewardsAvailable: async (dispatch, pool, data) => {
    // Save to state
    dispatch({
      type: ACTION_PREFIX + 'userRewardsAvailable',
      payload: {
        id: pool.id,
        userRewardsAvailable: data.userRewardsAvailable,
      },
    });
  },
  poolApy: async (dispatch, pool, data) => {},
  poolStaked: async (dispatch, pool, data) => {
    // Save to state
    dispatch({
      type: ACTION_PREFIX + 'poolStaked',
      payload: {
        id: pool.id,
        poolStaked: data.poolStaked,
      },
    });
  },
  poolTvl: async (dispatch, pool, data) => {},
  poolFinish: async (dispatch, pool, data) => {
    // Calculate pool status
    let poolStatus = pool.status;
    if (pool.status === 'active') {
      if (data.poolFinish === '0') {
        poolStatus = 'soon';
      } else if (data.poolFinish * 1000 < Date.now()) {
        poolStatus = 'closed';
      }
    }

    // Save to state
    dispatch({
      type: ACTION_PREFIX + 'poolFinish',
      payload: {
        id: pool.id,
        poolFinish: data.poolFinish,
        poolStatus,
      },
    });
  },
};

// update state with subscription results
const subscriptionReducers = {
  subscribe: (state, payload) => {
    return {
      ...state,
      subscriptions: {
        ...state.subscriptions,
        [payload.id]: {
          ...state.subscriptions[payload.id],
          ...Object.fromEntries(
            payload.subscriptions.map(subscription => [
              subscription,
              (state.subscriptions[payload.id][subscription] || 0) + 1,
            ])
          ),
        },
      },
    };
  },
  unsubscribe: (state, payload) => {
    return {
      ...state,
      subscriptions: {
        ...state.subscriptions,
        [payload.id]: {
          ...state.subscriptions[payload.id],
          ...Object.fromEntries(
            payload.subscriptions.map(subscription => [
              subscription,
              (state.subscriptions[payload.id][subscription] || 0) - 1,
            ])
          ),
        },
      },
    };
  },
  userApproval: (state, payload) => {
    return {
      ...state,
      userApproval: {
        ...state.userApproval,
        [payload.id]: payload.userApproval,
      },
    };
  },
  userBalance: (state, payload) => {
    return {
      ...state,
      userBalance: {
        ...state.userBalance,
        [payload.id]: payload.userBalance,
      },
    };
  },
  userStaked: (state, payload) => {
    return {
      ...state,
      userStaked: {
        ...state.userStaked,
        [payload.id]: payload.userStaked,
      },
    };
  },
  userRewardsAvailable: (state, payload) => {
    return {
      ...state,
      userRewardsAvailable: {
        ...state.userRewardsAvailable,
        [payload.id]: payload.userRewardsAvailable,
      },
    };
  },
  poolFinish: (state, payload) => {
    return {
      ...state,
      poolFinish: {
        ...state.poolFinish,
        [payload.id]: payload.poolFinish,
      },
      poolStatus: {
        ...state.poolStatus,
        [payload.id]: payload.poolStatus,
      },
    };
  },
  poolStaked: (state, payload) => {
    return {
      ...state,
      poolStaked: {
        ...state.poolStaked,
        [payload.id]: payload.poolStaked,
      },
    };
  },
};

export function reducer(state, action) {
  if (action.type.substr(0, ACTION_PREFIX.length) === ACTION_PREFIX) {
    const key = action.type.substr(ACTION_PREFIX.length);
    if (key in subscriptionReducers) {
      return subscriptionReducers[key](state, action.payload);
    } else {
      console.error(`No reducer for launchpool action ${key}`);
    }
  }

  return state;
}

// Exported so can be called on tx receipt (i.e. approval)
export async function updatePools(dispatch, getState) {
  const { home, stake } = getState();
  const { address: userAddress, web3: userWeb3 } = home;
  const { subscriptions } = stake;
  const hasAddress = userWeb3 && userAddress;
  const requestedCalls = {};

  // Get list of active subscriptions
  const activeSubscriptions = Object.fromEntries(
    Object.entries(subscriptions)
      .map(([poolId, poolSubscriptions]) => {
        const active = Object.entries(poolSubscriptions)
          .filter(([subscriptionKey, refCount]) => {
            return refCount > 0 && (hasAddress || subscriptionsDoNotNeedAddress[subscriptionKey]);
          })
          .map(([subscriptionKey]) => subscriptionKey);

        return active.length ? [poolId, active] : null;
      })
      .filter(entries => entries !== null)
  );

  // No active subscriptions?
  if (Object.keys(activeSubscriptions).length === 0) {
    console.log('activeSubscriptions', 0);
    return;
  }

  console.log('activeSubscriptions', activeSubscriptions);

  // Gets list of contract calls required to fulfill active subscriptions
  for (const [poolId, poolSubscriptions] of Object.entries(activeSubscriptions)) {
    // For each subscription in the pool
    for (const subscriptionKey of poolSubscriptions) {
      // Add this poolId to the list of requested calls
      for (const callKey of subscriptionCalls[subscriptionKey]) {
        // Group by group > pool > calls
        const groupKey = callGroups[callKey];

        if (!(groupKey in requestedCalls)) {
          requestedCalls[groupKey] = {};
        }

        if (!(poolId in requestedCalls[groupKey])) {
          requestedCalls[groupKey][poolId] = new Set();
        }

        if (!requestedCalls[groupKey][poolId].has(callKey)) {
          requestedCalls[groupKey][poolId].add(callKey);
        }
      }
    }
  }

  // Get RPC connection
  const web3 = userWeb3 || new Web3(new Web3.providers.HttpProvider(getRpcUrl()));
  const multicall = new MultiCall(web3, getNetworkMulticall());

  // Build groups of calls for multicall
  const allCalls = Object.entries(requestedCalls).map(([groupKey, groupContracts]) => {
    return Object.entries(groupContracts).map(([poolId, callKeys]) => {
      const pool = poolsById[poolId];
      const contract = callGroupContracts[groupKey](web3, pool);
      const calls = Object.fromEntries(
        Array.from(callKeys).map(call => [call, callFunctions[call](contract, pool, userAddress)])
      );

      calls.poolId = poolId;

      return calls;
    });
  });

  // Call all, and collect results by poolId
  const allResults = await multicall.all(allCalls);
  const resultsById = {};
  for (const groupResults of allResults) {
    for (const result of groupResults) {
      const { poolId, ...rest } = result;
      if (!(poolId in resultsById)) {
        resultsById[poolId] = {};
      }
      resultsById[poolId] = { ...resultsById[poolId], ...rest };
    }
  }

  console.log('resultsById', resultsById);

  // Subscription callsbacks
  const callbacks = [];
  for (const [poolId, poolSubscriptions] of Object.entries(activeSubscriptions)) {
    // For each subscription in the pool
    for (const subscriptionKey of poolSubscriptions) {
      callbacks.push(
        subscriptionCallbacks[subscriptionKey](dispatch, poolsById[poolId], resultsById[poolId])
      );
    }
  }

  return Promise.allSettled(callbacks);
}

function createSubscribePool(poolId, data) {
  return {
    type: ACTION_PREFIX + 'subscribe',
    payload: {
      id: poolId,
      subscriptions: Object.entries(data)
        .filter(([, subscribe]) => subscribe)
        .map(([key]) => key),
    },
  };
}

function createUnsubscribePool(poolId, data) {
  return {
    type: ACTION_PREFIX + 'unsubscribe',
    payload: {
      id: poolId,
      subscriptions: Object.entries(data)
        .filter(([, subscribe]) => subscribe)
        .map(([key]) => key),
    },
  };
}

// waits until there is at least 100ms between update calls before actually calling update
// ensure maximum number of subscriptions are captured for the update
let debounceUpdatePoolsTimer = null;

async function debounceUpdatePools(dispatch) {
  if (debounceUpdatePoolsTimer) {
    clearTimeout(debounceUpdatePoolsTimer);
    debounceUpdatePoolsTimer = null;
  }

  debounceUpdatePoolsTimer = setTimeout(() => {
    debounceUpdatePoolsTimer = null;
    console.log('debounce->throttleUpdatePools');
    dispatch(throttleUpdatePools);
  }, 100);
}

// only allow update to be called at most every MIN_UPDATE_DELAY ms
// ensure RPC is not spammed with calls
let throttleUpdatePoolsLastUpdate = 0;
let throttleUpdatePoolsTimer = null;

async function throttleUpdatePools(dispatch) {
  const now = Date.now();
  const timeSinceLast = now - throttleUpdatePoolsLastUpdate;

  if (throttleUpdatePoolsTimer) {
    clearTimeout(throttleUpdatePoolsTimer);
    throttleUpdatePoolsTimer = null;
  }

  if (timeSinceLast >= MIN_UPDATE_DELAY) {
    throttleUpdatePoolsLastUpdate = now;
    console.log('throttle->updatePools');
    dispatch(updatePools);
  } else {
    console.log('throttling...', timeSinceLast);
    throttleUpdatePoolsTimer = setTimeout(() => {
      dispatch(throttleUpdatePools);
    }, MIN_UPDATE_DELAY - timeSinceLast);
  }
}

export function useSubscriptions() {
  const dispatch = useDispatch();
  const update = useCallback(
    (immediate = false) => dispatch(immediate ? updatePools : debounceUpdatePools),
    [dispatch]
  );

  const unsubscribe = useCallback(
    (poolId, data) => dispatch(createUnsubscribePool(poolId, data)),
    [dispatch]
  );

  const subscribe = useCallback(
    (poolId, data) => {
      const action = createSubscribePool(poolId, data);

      // if we are subscribing to something
      if (action.payload.subscriptions.length) {
        // dispatch subscribe
        dispatch(action);
        // dispatch update
        update();
        // result is function that can undo the subscription
        return () => unsubscribe(poolId, data);
      }

      return NOOP;
    },
    [dispatch, update, unsubscribe]
  );

  return { subscribe, update };
}

export function useSubscriptionUpdates(updateInterval = DEFAULT_UPDATE_INTERVAL) {
  const { update } = useSubscriptions();
  const { web3, address } = useConnectWallet();

  // update on connect wallet
  useEffect(() => {
    if (web3 && address) {
      update();
    }
  }, [web3, address, update]);

  // update on interval
  useEffect(() => {
    const id = setInterval(update, updateInterval);
    return () => clearInterval(id);
  }, [updateInterval, update]);
}

export function usePoolFinish(id) {
  return useSelector(state => state.stake.poolFinish[id]);
}

export function usePoolStatus(id) {
  return useSelector(state => state.stake.poolStatus[id]);
}

export function usePoolStaked(id, decimals) {
  const raw = useSelector(state => state.stake.poolStaked[id]);
  return useMemo(() => {
    return byDecimals(raw, decimals);
  }, [raw, decimals]);
}

export function useUserApproval(id, decimals) {
  const raw = useSelector(state => state.stake.userApproval[id]);
  return useMemo(() => {
    return byDecimals(raw, decimals);
  }, [raw, decimals]);
}

export function useUserBalance(id, decimals) {
  const raw = useSelector(state => state.stake.userBalance[id]);
  return useMemo(() => {
    return byDecimals(raw, decimals);
  }, [raw, decimals]);
}

export function useUserStaked(id, decimals) {
  const raw = useSelector(state => state.stake.userStaked[id]);
  return useMemo(() => {
    return byDecimals(raw, decimals);
  }, [raw, decimals]);
}

export function useUserRewardsAvailable(id, decimals) {
  const raw = useSelector(state => state.stake.userRewardsAvailable[id]);
  return useMemo(() => {
    return byDecimals(raw, decimals);
  }, [raw, decimals]);
}
