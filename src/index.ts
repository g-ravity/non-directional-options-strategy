import 'dotenv-safe/config';
import Papa, { ParseResult } from 'papaparse';
import fs from 'fs';
import { homedir } from 'os';
import greeks from 'greeks';
import findLastIndex from 'lodash/findLastIndex';
import find from 'lodash/find';
import differenceInDays from 'date-fns/differenceInDays';

import { FILE_PATH, INTEREST_RATE, STRADDLE_SQ_OFF_TIME, STRADDLE_START_TIME, TICKERS_LIST, TICKER_INFO_MAP, UPDATE_INTERVAL } from './utils/constants';
import { IActivePosition, IOptionData } from './types';
import { addZeroPadding, getFormattedDate, isNotEmptyObject } from './utils/commonHelpers';
import { logger } from './utils/logger';

const onParseComplete = (results: ParseResult<IOptionData>) => {
	const optionsData = results.data;
	let tradeDate = '';
	let straddleEntryValue: number;
	const activePositions: IActivePosition = {};

	for (let i = 0; i < optionsData.length; i++) {
		const item = optionsData[i];

		const dateTime = item['Date/Time'] ? item['Date/Time'].split(' ') : undefined;
		if (dateTime && dateTime?.[0] !== tradeDate) tradeDate = dateTime?.[0];

		if (dateTime && item.Ticker && TICKERS_LIST.includes(item.Ticker)) {
			const updatedDate = getFormattedDate(tradeDate);
			const time = dateTime?.[1];
			const currentDateTime = new Date(`${updatedDate} ${time}`);

			const isAfterStartTime = currentDateTime >= new Date(`${updatedDate} ${STRADDLE_START_TIME}`);
			let isBeforeEndTime = true;

			while (isBeforeEndTime && isAfterStartTime) {
				const dateString = `${currentDateTime.getDate()}-${currentDateTime.getMonth() + 1}-${currentDateTime.getFullYear()}`;
				const timeString = `${addZeroPadding(currentDateTime.getHours())}:${addZeroPadding(currentDateTime.getMinutes())}:${addZeroPadding(currentDateTime.getSeconds())}`;
				const dateTimeString = `${dateString} ${timeString}`;

				const tickerDetails = find(optionsData, { Ticker: item.Ticker, 'Date/Time': dateTimeString });

				isBeforeEndTime = new Date(`${getFormattedDate(dateString)} ${timeString}`) < new Date(`${updatedDate} ${STRADDLE_SQ_OFF_TIME}`);

				const CEStrikes = [];
				const PEStrikes = [];

				if (!isNotEmptyObject(activePositions)) {
					const strike = Math.round(+tickerDetails.Open / 100) * 100;
					const CEStrike = `${item.Ticker}WK${strike}CE`;
					const PEStrike = `${item.Ticker}WK${strike}PE`;

					CEStrikes.push(CEStrike);
					PEStrikes.push(PEStrike);
				}

				const CEPrices = CEStrikes.map((CEStrike) => find(optionsData, { Ticker: CEStrike, 'Date/Time': dateTimeString }));
				const PEPrices = PEStrikes.map((PEStrike) => find(optionsData, { Ticker: PEStrike, 'Date/Time': dateTimeString }));
				const { Open: volatility } = find(optionsData, { Ticker: 'INDIAVIX', 'Date/Time': dateTimeString });

				const { 'Date/Time': expiryDateTime } = optionsData[findLastIndex(optionsData, (data) => data.Ticker === item.Ticker)];
				const daysToExpiry = differenceInDays(new Date(getFormattedDate(expiryDateTime.split(' ')[0])), new Date(updatedDate));

				const CEDelta = CEStrikes.map(
					(strike) => greeks.getDelta(+tickerDetails.Open, +strike.split('WK')[1].splice(0, -2), daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'call').toFixed(3) * 100,
				);
				const PEDelta = PEStrikes.map(
					(strike) => greeks.getDelta(+tickerDetails.Open, +strike.split('WK')[1].splice(0, -2), daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'put').toFixed(3) * 100,
				);

				const TotalCEDelta = CEDelta.reduce((total, delta) => total + delta, 0);
				const TotalPEDelta = PEDelta.reduce((total, delta) => total + delta, 0);

				logger.log('\nDetails: ', +tickerDetails.Open, 'CE Strikes: ', CEStrikes, 'PE Strikes: ', PEStrikes, daysToExpiry, +volatility, TotalCEDelta, TotalPEDelta);

				// if (isNaN(straddleEntryValue)) {
				// 	if (TotalCEDelta + TotalPEDelta < 20) {
				// 		straddleEntryValue = CEPrice + PEPrice;
				// 		logger.log(`${item.Ticker} Straddle -> Trade Date: ${dateString} @ ${timeString}\n`);
				// 		logger.log(`Sold ${CEStrike} at ₹${CEPrice}.\nSold ${PEStrike} at ₹${PEPrice}.\nCombined Premium = ₹${straddleEntryValue.toFixed(2)}`);
				// 		logger.log(`PNL: ${straddleEntryValue - (CEPrice + PEPrice)}\n`);
				// 	} else {
				// 		logger.log('Could not initiate the straddle as Delta Diff is greater than threshold\n');
				// 	}
				// } else {
				// 	if (TotalCEDelta + TotalPEDelta >= 20) {
				// 		logger.log('Need to do adjustments here!');
				// 	} else {
				// 		logger.log(`Current CE Price: ${CEPrice}\nCurrent PE Price: ${PEPrice}\nCombined Premium = ${(CEPrice + PEPrice).toFixed(2)}`);
				// 		logger.log(
				// 			`PNL @ ${addZeroPadding(currentDateTime.getHours())}:${addZeroPadding(currentDateTime.getMinutes())} -> ${(
				// 				(straddleEntryValue - (CEPrice + PEPrice)) *
				// 				TICKER_INFO_MAP[item.Ticker].lotSize *
				// 				TICKER_INFO_MAP[item.Ticker].noOfLots
				// 			).toFixed(2)}\n`,
				// 		);
				// 	}
				// }

				currentDateTime.setMinutes(currentDateTime.getMinutes() + UPDATE_INTERVAL);
				const nextDateString = `${currentDateTime.getDate()}-${currentDateTime.getMonth() + 1}-${currentDateTime.getFullYear()}`;
				const index = findLastIndex(optionsData, (data) => data.Ticker === item.Ticker && data['Date/Time'].includes(nextDateString));
				i = index;
			}

			straddleEntryValue = undefined;
		}
	}

	console.log('DONE! 🎉🎉 🎊🎊');
};

fs.readFile(`${homedir}/${FILE_PATH}`, 'utf8', (err, data) => {
	if (err) {
		logger.error(err);
		return;
	}

	Papa.parse<IOptionData>(data, {
		header: true,
		dynamicTyping: true,
		complete: onParseComplete,
		error: (err: Error) => logger.log('Something went wrong while parsing! \n', err),
		fastMode: true,
	});
});

// intradayEquity: function() {
//                     var e = this.buy
//                       , t = this.sell
//                       , a = this.quantity;
//                     isNaN(e) && (e = 0),
//                     isNaN(t) && (t = 0),
//                     isNaN(a) && (a = 0),
//                     void 0 !== this.equitytradingtype && 1 == this.equitytradingtype ? (this.turnOver = parseFloat(e * a + t * a).toFixed(2),
//                     this.brokerage = "0.00",
//                     this.stttotal = parseFloat(t * a * 25e-5).toFixed(2),
//                     this.totalTranCharge = parseFloat(345e-7 * this.turnOver).toFixed(2),
//                     this.othercharges = "0.00",
//                     this.clearingCharges = "0.00",
//                     this.servicetax = parseFloat(.18 * this.totalTranCharge).toFixed(2),
//                     this.stampduty = "0.00",
//                     this.sebifees = parseFloat(1e-6 * this.turnOver).toFixed(2),
//                     this.totalCost = parseFloat(parseFloat(this.stttotal) + parseFloat(this.totalTranCharge) + parseFloat(this.othercharges) + parseFloat(this.clearingCharges) + parseFloat(this.servicetax) + parseFloat(this.stampduty) + parseFloat(this.sebifees)).toFixed(2),
//                     this.breakeven = parseFloat(parseFloat(this.totalCost) / parseFloat(a)).toFixed(2)) : (this.turnOver = parseFloat(e * a + t * a).toFixed(2),
//                     this.brokerage = "0.00",
//                     this.stttotal = parseFloat(t * a * 25e-5).toFixed(2),
//                     this.totalTranCharge = parseFloat(3e-5 * this.turnOver).toFixed(2),
//                     this.othercharges = "0.00",
//                     this.clearingCharges = "0.00",
//                     this.servicetax = parseFloat(.18 * this.totalTranCharge).toFixed(2),
//                     this.stampduty = 0,
//                     this.sebifees = parseFloat(1e-6 * this.turnOver).toFixed(2),
//                     this.totalCost = parseFloat(parseFloat(this.stttotal) + parseFloat(this.totalTranCharge) + parseFloat(this.othercharges) + parseFloat(this.clearingCharges) + parseFloat(this.servicetax) + parseFloat(this.stampduty) + parseFloat(this.sebifees)).toFixed(2),
//                     this.breakeven = parseFloat(parseFloat(this.totalCost) / parseFloat(a)).toFixed(2))
//                 },
