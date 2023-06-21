import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
// import { priceData } from './priceData/priceData';
import { Link } from 'react-router-dom';
import { AiFillStar, AiOutlineStar } from 'react-icons/ai'
import { TbStarsFilled } from 'react-icons/tb'

function TradingPortal() {
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [priceData, setPriceData] = useState(null)
    const [stockName, setStockName] = useState("AAPL");

    const API_KEY = process.env.REACT_APP_API_KEY;

    useEffect(() => {
        const handleWindowResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleWindowResize);

        // return a cleanup function to remove the event listener when the component unmounts
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);

    async function handleSubmit(event) {
        event.preventDefault();

        console.log('searching tickers');

        // Reset price data
        setPriceData(null);

        const response = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${searchQuery}&apikey=${API_KEY}`);
        const data = await response.json();

        // update the state with best matches
        setSearchResults(data.bestMatches)
    }

    // fetch stock history
    async function fetchStock(symbol) {
        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${API_KEY}`);
        const data = await response.json();
        const timeSeries = data['Time Series (Daily)'] || {};
        let tradingDays = 0;
        let stockData = [];
        for(let key in timeSeries){
            if(tradingDays >= 504){ // ~2 trading yrs
                break;
            }
            stockData.push({
                time: key,
                open: parseFloat(timeSeries[key]['1. open']),
                high: parseFloat(timeSeries[key]['2. high']),
                low: parseFloat(timeSeries[key]['3. low']),
                close: parseFloat(timeSeries[key]['4. close']),

            });
            tradingDays++;
        }
        // Update priceData state with stock data
        return stockData.reverse();
    }

    useEffect(() => {
        // Fetch AAPL data on component mount
        fetchStock('AAPL').then(data => setPriceData(data));
    }, []); // Empty array ensures this runs only once on mount

    // reference to the div containing the chart:
    const chartContainerRef = useRef(); 
    const chartRef = useRef(null);

    useEffect(() => {
        if (priceData === null) { 
            return; // If there is no data, do not create the chart
        }

        console.log(`rendering chart`);

        if(chartRef.current){
            chartRef.current.remove();
            chartRef.current = null;
        }

        // Create a new chart:
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { color: '#212121' },
                textColor: '#DDD'
            },
            grid: {
                vertLines: { color: '#444' },
                horzLines: { color: '#444' }
            },
            watermark: {
                visible: true,
                fontSize: 24,
                horzAlign: 'center',
                vertAlign: 'bottom',
                color: 'rgb(0, 123, 255, 0.8)',
                text: stockName,
            },
        })

        // Save reference to new chart
        chartRef.current = chart;

        // convert candlestick data for use w/ a line series:
        const lineData = priceData.map(datapoint => ({
            time: datapoint.time,
            value: (datapoint.close + datapoint.open) / 2,
        }));

        // Add an area series to the chart,
        // Adding this before we add the candlestick chart
        // so that it will appear beneath the candlesticks
        const areaSeries = chart.addAreaSeries({
            lastValueVisible: false, // hide the last value marker for this series
            crosshairMarkerVisible: false, // hide the crosshair marker for this series
            lineColor: 'transparent', // hide the line
            topColor: 'rgba(56, 33, 110,0.6)',
            bottomColor: 'rgba(56, 33, 110, 0.1)',
        });
        // Set the data for the Area Series
        areaSeries.setData(lineData);

        // Create the Main Series (Candlesticks)
        // sample data w/ candlestick series:
        const mainSeries = chart.addCandlestickSeries();
        mainSeries.setData(priceData);

        // auto resize the chart:
        const resizeObserver = new ResizeObserver(entries => {
            window.requestAnimationFrame(() => {
                for (let entry of entries) {
                    const { width, height } = entry.contentRect;
                    chart.resize(width, height);
                }
            });
        });

        resizeObserver.observe(chartContainerRef.current);

        // clean up unmount
        return () => {
            if (chartContainerRef.current) {
                resizeObserver.unobserve(chartContainerRef.current);
            }
        };
    }, [priceData]);

  return (
    <>
    <div className='fixed w-full h-20 bg-[#212121] z-[100]'>
        <div className='flex justify-between items-center w-full h-full px-2 2xl:px-16'>
            <div className='flex items-center' >
            <Link to='/' smooth={true} duration={500} className='cursor-pointer mr-2 sm:mr-6'>
                <img src="/assets/path-white.png" alt="/" width='87' height='37' />
            </Link>
                <h4 className='text-sm sm:text-xl mr-1 sm:mr-2 text-white font-normal flex items-center justify-end'>Search Symbol:</h4>
                <div className='search-wrapper'>
                    <form onSubmit={handleSubmit} className='flex items-center font-semibold'>
                        <input 
                            type="search" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className='text-sm sm:text-base sm:px-2 h-6 sm:h-8 rounded-md' 
                        />
                        <input type="submit" value="Submit" className='border-2 text-white bg-transparent text-sm sm:text-base cursor-pointer hover:scale-105 ease-in duration-200 p-px sm:p-1 rounded-lg flex items-center justify-center mx-1 my-px shadow-md font-semibold tracking-wider' />
                    </form>
                    {searchResults.length > 0 && (
                        <div className='dropdown bg-transparent fixed text-black font-semibold rounded-lg'>
                            {searchResults.map((result, index) => (
                                <div 
                                key={index} 
                                id={result["1. symbol"]} 
                                className='bg-white rounded-md dropdown-item border p-1 w-full cursor-pointer hover:scale-105 ease-in duration-200'
                                onClick={async () => {
                                    try{
                                        const data = await fetchStock(result["1. symbol"]);
                                        setPriceData(data);
                                        setStockName(result["2. name"] || '$' + result["1. symbol"])
                                        setSearchResults([]);
                                    } catch (err){
                                        console.error(err);
                                    }
                                }}
                                >
                                    {result["1. symbol"]} - {result["2. name"]}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className='text-white text-xl flex items-center justify-center'>
                {windowWidth > 1020 ? (
                <>
                Favorites: 
                <button className='border bg-transparent text-lg p-2 rounded-lg hover:scale-105 ease-in duration-300 w-full flex items-center justify-center mx-2 shadow-md font-semibold tracking-wider' id='BTC'>$AAPL <AiFillStar className='w-10 text-yellow-300'/></button>
                <button className='border bg-transparent text-lg p-2 rounded-lg hover:scale-105 ease-in duration-300 w-full flex items-center justify-center mx-2 shadow-md font-semibold tracking-wider' id='ETH'>$AMZN <AiFillStar className='w-10 text-yellow-300'/></button>
                <button className='border bg-transparent text-lg p-2 rounded-lg hover:scale-105 ease-in duration-300 w-full flex items-center justify-center mx-2 shadow-md font-semibold tracking-wider' id='TSLA'>$TSLA <AiFillStar className='w-10 text-yellow-300'/></button>
                </>
                ) : (
                    <div><TbStarsFilled className='m-2 w-10' /></div>
                )}
            </div>
        </div>
    </div>
    <div id='TradingPortal' className='w-full h-screen'>
        <div className='p-4 w-full h-full mx-auto flex justify-center items-center text-white'>
            <div ref={chartContainerRef} className='w-full h-full' />
        </div>
    </div>
    </>
  );
}

export default TradingPortal