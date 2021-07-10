import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { byDecimals } from 'features/helpers/bignumber';
import { useConnectWallet } from '../../home/redux/hooks';
import {
  useFetchApproval,
  useFetchBalance,
  useFetchClaim,
  useFetchCurrentlyStaked,
  useFetchExit,
  useFetchPoolData,
  useFetchRewardsAvailable,
  useFetchStake,
  useFetchWithdraw,
} from '../redux/hooks';

import {
  Avatar,
  Box,
  Dialog,
  Grid,
  Link,
  makeStyles,
  TextField,
  Typography,
  useTheme,
} from '@material-ui/core';

import TwitterIcon from '@material-ui/icons/Twitter';
import TelegramIcon from '@material-ui/icons/Telegram';

import Button from '../../../components/CustomButtons/Button';
import { styles } from './styles/view';
import Divider from '@material-ui/core/Divider';
import { formatApy } from '../../helpers/format';
import { Helmet } from 'react-helmet';
import { usePageMeta } from '../../common/getPageMeta';
import { getNetworkLaunchpools } from '../../helpers/getNetworkData';
import { useSelector } from 'react-redux';
import {
  usePoolFinish,
  usePoolStaked,
  usePoolStatus,
  useSubscriptions,
  useSubscriptionUpdates,
} from '../redux/subscription';
import { StakeCountdown } from './StakeCountdown';
import ValueLoader from '../../common/components/ValueLoader/ValueLoader';

const useStyles = makeStyles(styles);
const launchpools = getNetworkLaunchpools();

export default function StakePool(props) {
  const classes = useStyles();
  const { t } = useTranslation();
  const { address } = useConnectWallet();
  const { fetchApproval } = useFetchApproval();
  const { fetchStake } = useFetchStake();
  const { fetchWithdraw } = useFetchWithdraw();
  const { fetchClaim } = useFetchClaim();
  const { fetchExit } = useFetchExit();
  const { pools, poolData, fetchPoolData } = useFetchPoolData();
  const [index, setIndex] = useState(pools.findIndex(p => p.id === props.match.params.id));
  const [showInput, setShowInput] = useState(false);
  const [inputVal, setInputVal] = useState(0);
  const [open, setOpen] = React.useState(false);
  const { getPageMeta } = usePageMeta();
  const theme = useTheme();
  const isNightMode = theme.palette.type === 'dark';

  // Get pool from url
  const poolId = props.match.params.id;

  const launchpool = useMemo(() => {
    return launchpools[poolId];
  }, [poolId]);
  console.log(poolId, launchpool);

  // Subscribe to updates for this pool
  const { subscribe } = useSubscriptions();
  useEffect(() => {
    return subscribe(launchpool.id, {
      userApproval: true,
      userBalance: true,
      userStaked: true,
      userRewardsAvailable: true,
      poolApy: true,
      poolStaked: true,
      poolTvl: true,
      poolFinish: true,
    });
  }, [subscribe, launchpool]);
  useSubscriptionUpdates();

  // Get pool state
  const poolHideCountdown = launchpool.hideCountdown === true;
  const poolFinish = usePoolFinish(launchpool.id);
  const poolStatus = usePoolStatus(launchpool.id);
  const poolStaked = usePoolStaked(launchpool.id, launchpool.tokenDecimals);
  const userApproval = useSelector(state => state.stake.userApproval[launchpool.id]);
  const userBalance = useSelector(state => state.stake.userBalance[launchpool.id]);
  const userStaked = useSelector(state => state.stake.userStaked[launchpool.id]);
  const userRewardsAvailable = useSelector(
    state => state.stake.userRewardsAvailable[launchpool.id]
  );
  const fetchApprovalPending = useSelector(
    state => state.stake.fetchApprovalPending[launchpool.id]
  );
  const fetchStakePending = useSelector(state => state.stake.fetchStakePending[launchpool.id]);
  const fetchWithdrawPending = useSelector(
    state => state.stake.fetchWithdrawPending[launchpool.id]
  );
  const fetchClaimPending = useSelector(state => state.stake.fetchClaimPending[launchpool.id]);
  const fetchExitPending = useSelector(state => state.stake.fetchExitPending[launchpool.id]);

  // Countdown timer/status
  const countdownStatus = useMemo(() => {
    if (poolStatus === 'closed') {
      return <>{t('Finished')}</>;
    } else if (poolStatus === 'soon') {
      return <>{t('Coming-Soon')}</>;
    } else if (poolFinish && !poolHideCountdown) {
      return (
        <>
          {t('End') + ': '}
          <StakeCountdown periodFinish={poolFinish} />
        </>
      );
    } else if (poolFinish === undefined && !poolHideCountdown) {
      return <ValueLoader />;
    }

    return <></>;
  }, [poolStatus, poolHideCountdown, poolFinish, t]);

  // Wallet Balance: BigNumber decimals
  const myBalance = useMemo(() => {
    return byDecimals(userBalance, launchpool.tokenDecimals);
  }, [userBalance, launchpool]);

  // Staked: BigNumber decimals
  const myCurrentlyStaked = useMemo(() => {
    return byDecimals(userStaked, launchpool.tokenDecimals);
  }, [userStaked, launchpool]);

  // Rewards available: BigNumber decimals
  const myRewardsAvailable = useMemo(() => {
    const amount = byDecimals(userRewardsAvailable, launchpool.earnedTokenDecimals);
    return launchpool.token === 'mooAutoWbnbFixed'
      ? amount.multipliedBy(96).dividedBy(100)
      : amount;
  }, [userRewardsAvailable, launchpool]);

  // TODO: remove once all instances of index replaced
  useEffect(() => {
    setIndex(pools.findIndex(p => p.id === poolId));
  }, [poolId, pools]);

  // Modal input change
  const changeInputVal = event => {
    let value = event.target.value;
    const changeIsNumber = /^[0-9]+\.?[0-9]*$/;
    if (!value) return setInputVal(value);
    if (changeIsNumber.test(value)) {
      value = value.replace(/(^[0-9]+)(\.?[0-9]*$)/, (word, p1, p2) => {
        return Number(p1).toString() + p2;
      });
      if (
        new BigNumber(Number(value)).comparedTo(
          showInput === 'stake' ? myBalance : myCurrentlyStaked
        ) === 1
      )
        return setInputVal(
          showInput === 'stake' ? myBalance.toString() : myCurrentlyStaked.toString()
        );
      setInputVal(value);
    }
  };

  // Approval: Needs approval
  const isNeedApproval = useMemo(() => {
    const stakeAmount = new BigNumber(inputVal);
    const approvalAmount = new BigNumber(userApproval);
    return approvalAmount.isZero() || stakeAmount.isGreaterThan(approvalAmount);
  }, [userApproval, inputVal]);

  // Approval: Submit tx
  const onApproval = useCallback(() => {
    fetchApproval(poolId);
  }, [fetchApproval, poolId]);

  // Stake: Submit tx
  const onStake = useCallback(() => {
    const amount = new BigNumber(inputVal)
      .multipliedBy(new BigNumber(10).exponentiatedBy(launchpool.tokenDecimals))
      .toString(10);
    fetchStake(poolId, amount);
    setOpen(false);
  }, [fetchStake, inputVal, launchpool, poolId, setOpen]);

  // Withdraw: Submit tx
  const onWithdraw = useCallback(() => {
    const amount = new BigNumber(inputVal)
      .multipliedBy(new BigNumber(10).exponentiatedBy(launchpool.tokenDecimals))
      .toString(10);
    fetchWithdraw(poolId, amount);
    setOpen(false);
  }, [fetchWithdraw, inputVal, launchpool, poolId, setOpen]);

  // Claim: Submit tx
  const onClaim = useCallback(() => {
    fetchClaim(poolId);
  }, [fetchClaim, poolId]);

  // Exit: Submit tx
  const onExit = useCallback(() => {
    fetchExit(poolId);
  }, [fetchExit, poolId]);

  useEffect(() => {
    fetchPoolData(index);
    const id = setInterval(() => {
      fetchPoolData(index);
    }, 10000);
    return () => clearInterval(id);
  }, [address, index]);

  const handleModal = (state, action = false) => {
    setOpen(state);
    setShowInput(action);
    setInputVal(0);
  };

  const getPoolShare = () => {
    return myCurrentlyStaked.toNumber() > 0
      ? (
          (Math.floor(myCurrentlyStaked.toNumber() * 10000) / 10000 / poolData[index].staked) *
          100
        ).toFixed(4)
      : 0;
  };

  const customBgImg = img => {
    return img
      ? {
          backgroundImage: 'url(' + require('images/' + img) + ')',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }
      : {};
  };

  return (
    <Grid container>
      <Helmet>
        <title>
          {getPageMeta('Stake-Meta-Title', {
            earnedToken: launchpool.earnedToken,
            boostedBy: launchpool.name,
          })}
        </title>
        <meta
          property="og:title"
          content={getPageMeta('Stake-Meta-Title', {
            earnedToken: launchpool.earnedToken,
            boostedBy: launchpool.name,
          })}
        />
      </Helmet>
      <Grid item xs={6} className={classes.mb}>
        <Button href="/stake" className={classes.roundedBtn}>
          {t('Stake-Button-Back')}
        </Button>
      </Grid>
      <Grid item xs={6} className={classes.mb}>
        <Typography className={classes.countdown}>{countdownStatus}</Typography>
      </Grid>

      <Grid
        container
        className={[
          classes.row,
          poolStatus === 'closed' || poolStatus === 'soon' ? classes.retired : '',
        ].join(' ')}
      >
        <Grid item xs={6} sm={6} md={3}>
          <Avatar
            src={require('images/' + pools[index].logo)}
            alt={pools.earnedToken}
            variant="square"
            imgProps={{ style: { objectFit: 'contain' } }}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Typography className={classes.title}>{`${
            Math.floor(myBalance.toNumber() * 10000) / 10000
          } ${
            pools[index].token === 'mooAutoWbnbFixed' ? 'mooAutoWBNB' : pools[index].token
          }`}</Typography>
          <Typography className={classes.subtitle}>{t('Vault-Wallet')}</Typography>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Typography className={classes.title}>{`${
            Math.floor(myCurrentlyStaked.toNumber() * 10000) / 10000
          } ${
            pools[index].token === 'mooAutoWbnbFixed' ? 'mooAutoWBNB' : pools[index].token
          }`}</Typography>
          <Typography className={classes.subtitle}>{t('Stake-Balancer-Current-Staked')}</Typography>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Box display="flex" justifyContent={'center'}>
            <Typography className={classes.title}>{`${
              Math.floor(myRewardsAvailable.toNumber() * 10000) / 10000
            } ${pools[index].earnedToken}`}</Typography>
            <Avatar className={classes.fire} src={require('images/stake/fire.png')} />
          </Box>
          <Typography className={classes.subtitle}>
            {t('Stake-Balancer-Rewards-Available')}
          </Typography>
        </Grid>
      </Grid>

      <Grid
        container
        className={[
          classes.row,
          poolStatus === 'closed' || poolStatus === 'soon' ? classes.retired : '',
        ].join(' ')}
      >
        <Grid item xs={12} sm={4}>
          <Typography className={classes.title}>
            {poolData[index].staked}
            <br />
            {poolStaked.toFixed(2)}
          </Typography>
          <Typography className={classes.subtitle}>
            {t('Stake-Total-Value-Locked', { mooToken: pools[index].token })}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography className={classes.title}>{getPoolShare()}%</Typography>
          <Typography className={classes.subtitle}>{t('Stake-Your-Pool')}%</Typography>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography className={classes.title}>{formatApy(poolData[index].apy)}</Typography>
          <Typography className={classes.subtitle}>{t('Vault-APR')}</Typography>
        </Grid>

        {poolStatus === 'closed' || poolStatus === 'soon' ? (
          <Box className={classes.ribbon}>
            <span className={poolStatus}>
              {poolStatus === 'closed'
                ? t('Finished')
                : poolStatus === 'soon'
                ? t('Coming-Soon')
                : ''}
            </span>
          </Box>
        ) : (
          ''
        )}
      </Grid>

      <Grid container className={classes.row}>
        {launchpool.partnership ? (
          <Box className={classes.boosted}>{t('Stake-BoostedBy', { name: launchpool.name })}</Box>
        ) : (
          ''
        )}
        <Grid item xs={12} md={6} lg={3}>
          {isNeedApproval ? (
            <Button
              className={classes.actionBtn}
              disabled={fetchApprovalPending}
              onClick={onApproval}
            >
              {t('Stake-Button-Approval')}
            </Button>
          ) : (
            <Button
              className={[classes.actionBtn, launchpool.partnership ? classes.btnBoost : ''].join(
                ' '
              )}
              onClick={() => {
                handleModal(true, 'stake');
              }}
            >
              {launchpool.partnership ? (
                <Box className={classes.boost}>
                  <Box>
                    <Avatar
                      src={require('images/' + launchpool.logo)}
                      alt={launchpool.token}
                      variant="square"
                      imgProps={{ style: { objectFit: 'contain' } }}
                    />
                  </Box>
                  <Box>
                    <img
                      alt={t('Boost')}
                      className={classes.boostImg}
                      src={require('images/stake/boost.svg')}
                    />
                  </Box>
                </Box>
              ) : (
                t('Stake-Button-Stake-Tokens')
              )}
            </Button>
          )}
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Button
            className={classes.actionBtn}
            disabled={fetchWithdrawPending}
            onClick={() => {
              handleModal(true, 'unstake');
            }}
          >
            {t('Stake-Button-Unstake-Tokens')}
          </Button>
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Button className={classes.actionBtn} disabled={fetchClaimPending} onClick={onClaim}>
            {t('Stake-Button-Claim-Rewards')}
          </Button>
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Button className={classes.actionBtn} disabled={fetchExitPending} onClick={onExit}>
            {t('Stake-Button-Exit')}
          </Button>
        </Grid>
      </Grid>

      {launchpool.partners.map(partner => (
        <Grid
          container
          key={partner.website}
          className={classes.row}
          style={customBgImg(partner.background)}
        >
          <Grid item xs={12} className={classes.partnerHeader}>
            {isNightMode && partner.logoNight ? (
              <img alt={launchpool.name} src={require('images/' + partner.logoNight)} height="60" />
            ) : partner.logo ? (
              <img alt={launchpool.name} src={require('images/' + partner.logo)} height="60" />
            ) : (
              ''
            )}
          </Grid>
          <Grid item xs={12} className={classes.partnerBody}>
            {partner.text}
          </Grid>
          <Grid item xs={12}>
            <Divider className={classes.divider} />
            {partner.social.twitter ? (
              <Link href={partner.social.twitter}>
                <TwitterIcon />
              </Link>
            ) : (
              ''
            )}
            {partner.social.telegram ? (
              <Link href={partner.social.telegram}>
                <TelegramIcon />
              </Link>
            ) : (
              ''
            )}
            {partner.website ? (
              <Grid item xs={12}>
                <Link target="_blank" href={partner.website}>
                  {partner.website}
                </Link>
              </Grid>
            ) : (
              ''
            )}
          </Grid>
        </Grid>
      ))}

      <Dialog
        onClose={() => {
          handleModal(false);
        }}
        aria-labelledby="customized-dialog-title"
        open={open}
      >
        <Grid container className={classes.modal}>
          <Grid item xs={12}>
            <Typography className={classes.h1}>Stake your tokens</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography
              className={classes.balance}
              onClick={() => {
                setInputVal(
                  showInput === 'stake' ? myBalance.toString() : myCurrentlyStaked.toString()
                );
              }}
            >
              {launchpool.token} Balance:{' '}
              {showInput === 'stake' ? myBalance.toString() : myCurrentlyStaked.toString()}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <form noValidate autoComplete="off">
              <TextField
                className={classes.input}
                value={inputVal}
                onChange={changeInputVal}
                autoFocus
              />
            </form>
          </Grid>
          <Grid item xs={12} className={classes.modalbtns}>
            <Button onClick={() => handleModal(false)} className={classes.actionBtn}>
              {t('Stake-Button-Back')}
            </Button>
            <Button
              className={[
                classes.actionBtn,
                launchpool.partnership && showInput === 'stake' ? classes.btnBoost : '',
              ].join(' ')}
              disabled={showInput === 'stake' ? fetchStakePending : fetchWithdrawPending}
              onClick={showInput === 'stake' ? onStake : onWithdraw}
            >
              {showInput === 'stake' ? (
                launchpool.partnership ? (
                  <Box className={classes.boost}>
                    <Box>
                      <Avatar
                        src={require('images/' + launchpool.logo)}
                        alt={launchpool.earnedToken}
                        variant="square"
                        imgProps={{ style: { objectFit: 'contain' } }}
                      />
                    </Box>
                    <Box>
                      <img className={classes.boostImg} src={require('images/stake/boost.svg')} />
                    </Box>
                  </Box>
                ) : (
                  t('Stake-Button-Stake-Tokens')
                )
              ) : (
                t('Stake-Button-Unstake-Tokens')
              )}
            </Button>
          </Grid>
        </Grid>
      </Dialog>
    </Grid>
  );
}
