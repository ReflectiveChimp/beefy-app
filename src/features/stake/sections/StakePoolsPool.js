import React, { useEffect, useMemo } from 'react';
import { StakeCountdown } from './StakeCountdown';
import { Avatar, Box, Grid, Typography } from '@material-ui/core';
import Button from '../../../components/CustomButtons/Button';
import { useSelector } from 'react-redux';
import ValueLoader from '../../common/components/ValueLoader/ValueLoader';
import { useLaunchpoolSubscriptions } from '../redux/hooks';

export function StakePoolsPool({ showPools, classes, pool, t }) {
  const id = pool.id;
  const hideCountdown = pool.hideCountdown === true;
  const periodFinish = useSelector(state => state.stake.poolFinish[pool.id]);
  const status = useSelector(state => state.stake.poolStatus[pool.id]);
  const { subscribe } = useLaunchpoolSubscriptions();

  const countdownStatus = useMemo(() => {
    if (status === 'closed') {
      return <>{t('Finished')}</>;
    } else if (status === 'soon') {
      return <>{t('Coming-Soon')}</>;
    } else if (periodFinish && !hideCountdown) {
      return <StakeCountdown periodFinish={periodFinish} />;
    } else if (periodFinish === undefined && !hideCountdown) {
      return <ValueLoader />;
    }

    return <></>;
  }, [status, hideCountdown, periodFinish, t]);

  useEffect(() => {
    return subscribe(id, {
      poolFinish: status !== 'closed',
    });
  }, [subscribe, id, status]);

  if (
    showPools === 'all' ||
    (showPools === 'active' && status === showPools) ||
    (showPools === 'active' && status === 'soon') ||
    (showPools === 'closed' && status === showPools)
  ) {
    return (
      <Grid xs={12} sm={6} md={6} lg={3} item>
        <Grid
          className={[
            classes.item,
            status === 'closed' ? classes.itemRetired : status === 'soon' ? classes.itemSoon : '',
          ].join(' ')}
        >
          {pool.partnership ? (
            <Box className={classes.boosted}>{t('Stake-BoostedBy', { name: pool.name })}</Box>
          ) : (
            ''
          )}
          <Typography className={classes.title} variant="body2" gutterBottom>
            Earn {pool.earnedToken}
          </Typography>
          <Avatar
            src={require('images/' + pool.logo)}
            alt={pool.earnedToken}
            variant="square"
            imgProps={{ style: { objectFit: 'contain' } }}
          />

          <Typography className={classes.countdown}>{countdownStatus}</Typography>

          <Typography className={classes.subtitle} variant="body2">
            {pool.token === 'mooAutoWbnbFixed' ? 'mooAutoWBNB' : pool.token}
          </Typography>
          <Button xs={5} md={2} className={classes.stakeBtn} href={`/stake/pool/${pool.id}`}>
            {status === 'closed' ? t('Stake-Button-Claim') : t('Stake-Button-Stake')}
          </Button>
          {status === 'closed' || status === 'soon' ? (
            <Box className={classes.ribbon}>
              <span className={status}>
                {status === 'closed' ? t('Finished') : t('Coming-Soon')}
              </span>
            </Box>
          ) : (
            ''
          )}
        </Grid>
      </Grid>
    );
  }

  return null;
}
