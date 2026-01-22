/**
 * Populate database with S&P 500 stocks
 * This will create asset records for all S&P 500 companies
 */

import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/services/prisma';
import { finnhubService } from '../src/services/finnhub';

// Ticker to company name mapping
const TICKER_NAMES: Record<string, string> = {
  // Technology & Communication Services
  'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft Corporation', 'GOOGL': 'Alphabet Inc. Class A', 'GOOG': 'Alphabet Inc. Class C',
  'AMZN': 'Amazon.com Inc.', 'NVDA': 'NVIDIA Corporation', 'META': 'Meta Platforms Inc.', 'TSLA': 'Tesla Inc.',
  'AVGO': 'Broadcom Inc.', 'ORCL': 'Oracle Corporation', 'ADBE': 'Adobe Inc.', 'CRM': 'Salesforce Inc.',
  'CSCO': 'Cisco Systems Inc.', 'ACN': 'Accenture plc', 'AMD': 'Advanced Micro Devices Inc.', 'INTC': 'Intel Corporation',
  'IBM': 'International Business Machines Corporation', 'QCOM': 'QUALCOMM Incorporated', 'TXN': 'Texas Instruments Incorporated',
  'INTU': 'Intuit Inc.', 'NOW': 'ServiceNow Inc.', 'AMAT': 'Applied Materials Inc.', 'ADI': 'Analog Devices Inc.',
  'LRCX': 'Lam Research Corporation', 'KLAC': 'KLA Corporation', 'SNPS': 'Synopsys Inc.', 'CDNS': 'Cadence Design Systems Inc.',
  'MCHP': 'Microchip Technology Incorporated', 'PANW': 'Palo Alto Networks Inc.', 'NXPI': 'NXP Semiconductors N.V.',
  'ADSK': 'Autodesk Inc.', 'FTNT': 'Fortinet Inc.', 'ANET': 'Arista Networks Inc.', 'APH': 'Amphenol Corporation',
  'MSI': 'Motorola Solutions Inc.', 'TEL': 'TE Connectivity Ltd.', 'ROP': 'Roper Technologies Inc.',
  'PLTR': 'Palantir Technologies Inc.', 'CRWD': 'CrowdStrike Holdings Inc.', 'APP': 'AppLovin Corporation',
  'NFLX': 'Netflix Inc.', 'DIS': 'The Walt Disney Company', 'CMCSA': 'Comcast Corporation', 'T': 'AT&T Inc.',
  'VZ': 'Verizon Communications Inc.', 'TMUS': 'T-Mobile US Inc.', 'CHTR': 'Charter Communications Inc.',
  'EA': 'Electronic Arts Inc.', 'TTWO': 'Take-Two Interactive Software Inc.', 'NTES': 'NetEase Inc.',
  
  // Financials
  'BRK.B': 'Berkshire Hathaway Inc. Class B', 'JPM': 'JPMorgan Chase & Co.', 'V': 'Visa Inc.', 'MA': 'Mastercard Incorporated',
  'BAC': 'Bank of America Corporation', 'WFC': 'Wells Fargo & Company', 'MS': 'Morgan Stanley', 'GS': 'The Goldman Sachs Group Inc.',
  'SPGI': 'S&P Global Inc.', 'BLK': 'BlackRock Inc.', 'C': 'Citigroup Inc.', 'AXP': 'American Express Company',
  'SCHW': 'The Charles Schwab Corporation', 'BX': 'Blackstone Inc.', 'CB': 'Chubb Limited', 'MMC': 'Marsh & McLennan Companies Inc.',
  'PGR': 'The Progressive Corporation', 'AON': 'Aon plc', 'ICE': 'Intercontinental Exchange Inc.', 'CME': 'CME Group Inc.',
  'USB': 'U.S. Bancorp', 'TFC': 'Truist Financial Corporation', 'PNC': 'The PNC Financial Services Group Inc.',
  'COF': 'Capital One Financial Corporation', 'AIG': 'American International Group Inc.', 'MET': 'MetLife Inc.',
  'PRU': 'Prudential Financial Inc.', 'AFL': 'Aflac Incorporated', 'ALL': 'The Allstate Corporation', 'TRV': 'The Travelers Companies Inc.',
  'AJG': 'Arthur J. Gallagher & Co.', 'HIG': 'The Hartford Financial Services Group Inc.', 'CINF': 'Cincinnati Financial Corporation',
  'WRB': 'W. R. Berkley Corporation', 'L': 'Loews Corporation', 'GL': 'Globe Life Inc.', 'BEN': 'Franklin Resources Inc.',
  'STT': 'State Street Corporation', 'NTRS': 'Northern Trust Corporation', 'KEY': 'KeyCorp', 'CFG': 'Citizens Financial Group Inc.',
  'RF': 'Regions Financial Corporation', 'FITB': 'Fifth Third Bancorp', 'HBAN': 'Huntington Bancshares Incorporated',
  'MTB': 'M&T Bank Corporation', 'ZION': 'Zions Bancorporation N.A.', 'WBS': 'Webster Financial Corporation',
  'CMA': 'Comerica Incorporated', 'FRC': 'First Republic Bank', 'SIVB': 'SVB Financial Group',
  
  // Healthcare
  'UNH': 'UnitedHealth Group Incorporated', 'JNJ': 'Johnson & Johnson', 'LLY': 'Eli Lilly and Company', 'ABBV': 'AbbVie Inc.',
  'MRK': 'Merck & Co. Inc.', 'TMO': 'Thermo Fisher Scientific Inc.', 'ABT': 'Abbott Laboratories', 'DHR': 'Danaher Corporation',
  'PFE': 'Pfizer Inc.', 'BMY': 'Bristol-Myers Squibb Company', 'AMGN': 'Amgen Inc.', 'CVS': 'CVS Health Corporation',
  'CI': 'Cigna Corporation', 'MDT': 'Medtronic plc', 'GILD': 'Gilead Sciences Inc.', 'VRTX': 'Vertex Pharmaceuticals Incorporated',
  'REGN': 'Regeneron Pharmaceuticals Inc.', 'ISRG': 'Intuitive Surgical Inc.', 'BSX': 'Boston Scientific Corporation',
  'SYK': 'Stryker Corporation', 'ZTS': 'Zoetis Inc.', 'ELV': 'Elevance Health Inc.', 'HCA': 'HCA Healthcare Inc.',
  'MCK': 'McKesson Corporation', 'CAH': 'Cardinal Health Inc.', 'COR': 'Cencora Inc.', 'BIIB': 'Biogen Inc.',
  'HUM': 'Humana Inc.', 'BDX': 'Becton Dickinson and Company', 'EW': 'Edwards Lifesciences Corporation',
  'IQV': 'IQVIA Holdings Inc.', 'A': 'Agilent Technologies Inc.', 'IDXX': 'IDEXX Laboratories Inc.',
  'RMD': 'ResMed Inc.', 'DXCM': 'DexCom Inc.', 'MTD': 'Mettler-Toledo International Inc.', 'BAX': 'Baxter International Inc.',
  'STE': 'STERIS plc', 'ALGN': 'Align Technology Inc.', 'HOLX': 'Hologic Inc.', 'WAT': 'Waters Corporation',
  'PKI': 'PerkinElmer Inc.', 'TFX': 'Teleflex Incorporated', 'PODD': 'Insulet Corporation', 'TECH': 'Bio-Techne Corporation',
  
  // Consumer Discretionary
  'HD': 'The Home Depot Inc.', 'MCD': 'McDonald\'s Corporation', 'NKE': 'NIKE Inc.', 'LOW': 'Lowe\'s Companies Inc.',
  'SBUX': 'Starbucks Corporation', 'BKNG': 'Booking Holdings Inc.', 'TJX': 'The TJX Companies Inc.', 'ABNB': 'Airbnb Inc.',
  'GM': 'General Motors Company', 'F': 'Ford Motor Company', 'MAR': 'Marriott International Inc.', 'HLT': 'Hilton Worldwide Holdings Inc.',
  'CMG': 'Chipotle Mexican Grill Inc.', 'ORLY': 'O\'Reilly Automotive Inc.', 'AZO': 'AutoZone Inc.', 'YUM': 'Yum! Brands Inc.',
  'ROST': 'Ross Stores Inc.', 'DHI': 'D.R. Horton Inc.', 'LEN': 'Lennar Corporation', 'GPC': 'Genuine Parts Company',
  'EBAY': 'eBay Inc.', 'TSCO': 'Tractor Supply Company', 'APTV': 'Aptiv PLC', 'DECK': 'Deckers Outdoor Corporation',
  'POOL': 'Pool Corporation', 'LVS': 'Las Vegas Sands Corp.', 'MGM': 'MGM Resorts International', 'WYNN': 'Wynn Resorts Limited',
  'CCL': 'Carnival Corporation & plc', 'RCL': 'Royal Caribbean Cruises Ltd.', 'NCLH': 'Norwegian Cruise Line Holdings Ltd.',
  'ULTA': 'Ulta Beauty Inc.', 'LULU': 'Lululemon Athletica Inc.', 'TPR': 'Tapestry Inc.', 'RL': 'Ralph Lauren Corporation',
  'PVH': 'PVH Corp.', 'VFC': 'V.F. Corporation', 'HBI': 'Hanesbrands Inc.', 'UAA': 'Under Armour Inc. Class A',
  'UA': 'Under Armour Inc. Class C', 'CROX': 'Crocs Inc.', 'SKX': 'Skechers U.S.A. Inc.',
  
  // Industrials
  'UPS': 'United Parcel Service Inc.', 'HON': 'Honeywell International Inc.', 'UNP': 'Union Pacific Corporation',
  'RTX': 'RTX Corporation', 'BA': 'The Boeing Company', 'CAT': 'Caterpillar Inc.', 'DE': 'Deere & Company',
  'LMT': 'Lockheed Martin Corporation', 'GE': 'General Electric Company', 'MMM': '3M Company', 'ADP': 'Automatic Data Processing Inc.',
  'WM': 'Waste Management Inc.', 'ETN': 'Eaton Corporation plc', 'ITW': 'Illinois Tool Works Inc.', 'NOC': 'Northrop Grumman Corporation',
  'EMR': 'Emerson Electric Co.', 'PH': 'Parker-Hannifin Corporation', 'GD': 'General Dynamics Corporation',
  'TDG': 'TransDigm Group Incorporated', 'CARR': 'Carrier Global Corporation', 'PCAR': 'PACCAR Inc',
  'JCI': 'Johnson Controls International plc', 'CMI': 'Cummins Inc.', 'FDX': 'FedEx Corporation', 'NSC': 'Norfolk Southern Corporation',
  'CSX': 'CSX Corporation', 'WMB': 'The Williams Companies Inc.', 'IR': 'Ingersoll Rand Inc.', 'OTIS': 'Otis Worldwide Corporation',
  'AME': 'AMETEK Inc.', 'FAST': 'Fastenal Company', 'PAYX': 'Paychex Inc.', 'VRSK': 'Verisk Analytics Inc.',
  'ROK': 'Rockwell Automation Inc.', 'DAL': 'Delta Air Lines Inc.', 'UAL': 'United Airlines Holdings Inc.', 'LUV': 'Southwest Airlines Co.',
  'AAL': 'American Airlines Group Inc.', 'GWW': 'W.W. Grainger Inc.', 'SWK': 'Stanley Black & Decker Inc.', 'DOV': 'Dover Corporation',
  'EXPD': 'Expeditors International of Washington Inc.', 'CHRW': 'C.H. Robinson Worldwide Inc.', 'JBHT': 'J.B. Hunt Transport Services Inc.',
  'XYL': 'Xylem Inc.', 'IEX': 'IDEX Corporation', 'LDOS': 'Leidos Holdings Inc.', 'CTAS': 'Cintas Corporation',
  'URI': 'United Rentals Inc.', 'PWR': 'Quanta Services Inc.',
  
  // Consumer Staples
  'WMT': 'Walmart Inc.', 'PG': 'The Procter & Gamble Company', 'KO': 'The Coca-Cola Company', 'PEP': 'PepsiCo Inc.',
  'COST': 'Costco Wholesale Corporation', 'PM': 'Philip Morris International Inc.', 'MO': 'Altria Group Inc.',
  'CL': 'Colgate-Palmolive Company', 'MDLZ': 'Mondelez International Inc.', 'KMB': 'Kimberly-Clark Corporation',
  'GIS': 'General Mills Inc.', 'ADM': 'Archer-Daniels-Midland Company', 'HSY': 'The Hershey Company', 'SYY': 'Sysco Corporation',
  'KHC': 'The Kraft Heinz Company', 'CLX': 'The Clorox Company', 'K': 'Kellogg Company', 'CHD': 'Church & Dwight Co. Inc.',
  'MKC': 'McCormick & Company Incorporated', 'TSN': 'Tyson Foods Inc.', 'KR': 'The Kroger Co.', 'SJM': 'The J. M. Smucker Company',
  'CAG': 'Conagra Brands Inc.', 'CPB': 'Campbell Soup Company', 'HRL': 'Hormel Foods Corporation', 'LW': 'Lamb Weston Holdings Inc.',
  'TAP': 'Molson Coors Beverage Company', 'BF.B': 'Brown-Forman Corporation Class B', 'STZ': 'Constellation Brands Inc.',
  'DG': 'Dollar General Corporation', 'MNST': 'Monster Beverage Corporation', 'KDP': 'Keurig Dr Pepper Inc.',
  'EL': 'The Estée Lauder Companies Inc.', 'CLF': 'Cleveland-Cliffs Inc.', 'WBA': 'Walgreens Boots Alliance Inc.',
  'DPZ': 'Domino\'s Pizza Inc.',
  
  // Energy
  'XOM': 'Exxon Mobil Corporation', 'CVX': 'Chevron Corporation', 'COP': 'ConocoPhillips', 'SLB': 'Schlumberger Limited',
  'EOG': 'EOG Resources Inc.', 'MPC': 'Marathon Petroleum Corporation', 'PSX': 'Phillips 66', 'VLO': 'Valero Energy Corporation',
  'OXY': 'Occidental Petroleum Corporation', 'HAL': 'Halliburton Company', 'HES': 'Hess Corporation', 'KMI': 'Kinder Morgan Inc.',
  'BKR': 'Baker Hughes Company', 'FANG': 'Diamondback Energy Inc.', 'DVN': 'Devon Energy Corporation', 'EQT': 'EQT Corporation',
  'TRGP': 'Targa Resources Corp.', 'LNG': 'Cheniere Energy Inc.', 'CTRA': 'Coterra Energy Inc.', 'MRO': 'Marathon Oil Corporation',
  'APA': 'APA Corporation', 'OKE': 'ONEOK Inc.', 'CHRD': 'Chord Energy Corporation', 'FTI': 'TechnipFMC plc',
  'NOV': 'NOV Inc.', 'CVE': 'Cenovus Energy Inc.', 'HFC': 'HollyFrontier Corporation', 'OVV': 'Ovintiv Inc.',
  'PR': 'Permian Resources Corporation',
  
  // Utilities
  'NEE': 'NextEra Energy Inc.', 'SO': 'The Southern Company', 'DUK': 'Duke Energy Corporation', 'D': 'Dominion Energy Inc.',
  'AEP': 'American Electric Power Company Inc.', 'SRE': 'Sempra Energy', 'EXC': 'Exelon Corporation', 'XEL': 'Xcel Energy Inc.',
  'ED': 'Consolidated Edison Inc.', 'WEC': 'WEC Energy Group Inc.', 'ES': 'Eversource Energy', 'AWK': 'American Water Works Company Inc.',
  'DTE': 'DTE Energy Company', 'PEG': 'Public Service Enterprise Group Incorporated', 'FE': 'FirstEnergy Corp.',
  'EIX': 'Edison International', 'ETR': 'Entergy Corporation', 'PPL': 'PPL Corporation', 'AEE': 'Ameren Corporation',
  'CMS': 'CMS Energy Corporation', 'CNP': 'CenterPoint Energy Inc.', 'NI': 'NiSource Inc.', 'LNT': 'Alliant Energy Corporation',
  'EVRG': 'Evergy Inc.', 'AES': 'The AES Corporation', 'PCG': 'PG&E Corporation', 'NRG': 'NRG Energy Inc.',
  'VST': 'Vistra Corp.', 'CEG': 'Constellation Energy Corporation', 'ATO': 'Atmos Energy Corporation',
  
  // Real Estate
  'PLD': 'Prologis Inc.', 'AMT': 'American Tower Corporation', 'EQIX': 'Equinix Inc.', 'CCI': 'Crown Castle Inc.',
  'PSA': 'Public Storage', 'SPG': 'Simon Property Group Inc.', 'O': 'Realty Income Corporation', 'WELL': 'Welltower Inc.',
  'DLR': 'Digital Realty Trust Inc.', 'AVB': 'AvalonBay Communities Inc.', 'EQR': 'Equity Residential', 'VICI': 'VICI Properties Inc.',
  'VTR': 'Ventas Inc.', 'SBAC': 'SBA Communications Corporation', 'WY': 'Weyerhaeuser Company', 'ARE': 'Alexandria Real Estate Equities Inc.',
  'INVH': 'Invitation Homes Inc.', 'ESS': 'Essex Property Trust Inc.', 'MAA': 'Mid-America Apartment Communities Inc.',
  'EXR': 'Extra Space Storage Inc.', 'UDR': 'UDR Inc.', 'CPT': 'Camden Property Trust', 'HST': 'Host Hotels & Resorts Inc.',
  'REG': 'Regency Centers Corporation', 'BXP': 'Boston Properties Inc.', 'FRT': 'Federal Realty Investment Trust',
  'KIM': 'Kimco Realty Corporation', 'VNO': 'Vornado Realty Trust', 'AIV': 'Apartment Investment and Management Company',
  'SLG': 'SL Green Realty Corp.',
  
  // Materials
  'LIN': 'Linde plc', 'APD': 'Air Products and Chemicals Inc.', 'SHW': 'The Sherwin-Williams Company', 'ECL': 'Ecolab Inc.',
  'DD': 'DuPont de Nemours Inc.', 'NEM': 'Newmont Corporation', 'FCX': 'Freeport-McMoRan Inc.', 'DOW': 'Dow Inc.',
  'NUE': 'Nucor Corporation', 'VMC': 'Vulcan Materials Company', 'MLM': 'Martin Marietta Materials Inc.', 'CTVA': 'Corteva Inc.',
  'ALB': 'Albemarle Corporation', 'IFF': 'International Flavors & Fragrances Inc.', 'BALL': 'Ball Corporation',
  'AVY': 'Avery Dennison Corporation', 'PPG': 'PPG Industries Inc.', 'EMN': 'Eastman Chemical Company', 'MOS': 'The Mosaic Company',
  'CE': 'Celanese Corporation', 'FMC': 'FMC Corporation', 'IP': 'International Paper Company', 'PKG': 'Packaging Corporation of America',
  'AMCR': 'Amcor plc', 'SEE': 'Sealed Air Corporation', 'CF': 'CF Industries Holdings Inc.', 'LYB': 'LyondellBasell Industries N.V.',
  'SW': 'Smurfit WestRock plc', 'WRK': 'WestRock Company', 'STLD': 'Steel Dynamics Inc.',
  
  // Additional Tech & Software
  'WDAY': 'Workday Inc.', 'DDOG': 'Datadog Inc.', 'ZS': 'Zscaler Inc.', 'TEAM': 'Atlassian Corporation', 'SNOW': 'Snowflake Inc.',
  'HUBS': 'HubSpot Inc.', 'BILL': 'Bill.com Holdings Inc.', 'CFLT': 'Confluent Inc.', 'S': 'SentinelOne Inc.',
  'ZM': 'Zoom Video Communications Inc.', 'OKTA': 'Okta Inc.', 'DOCU': 'DocuSign Inc.', 'TWLO': 'Twilio Inc.',
  'NET': 'Cloudflare Inc.', 'COUP': 'Coupa Software Incorporated', 'VEEV': 'Veeva Systems Inc.', 'SPLK': 'Splunk Inc.',
  'MRVL': 'Marvell Technology Inc.', 'ON': 'ON Semiconductor Corporation', 'MU': 'Micron Technology Inc.',
  
  // Additional Healthcare & Biotech
  'MOH': 'Molina Healthcare Inc.', 'VTRS': 'Viatris Inc.', 'CRL': 'Charles River Laboratories International Inc.',
  'HSIC': 'Henry Schein Inc.', 'DGX': 'Quest Diagnostics Incorporated', 'SOLV': 'Solventum Corporation',
  'UHS': 'Universal Health Services Inc.', 'CNC': 'Centene Corporation', 'ANTM': 'Anthem Inc.',
  
  // Additional Financials & Insurance
  'BRO': 'Brown & Brown Inc.', 'FNF': 'Fidelity National Financial Inc.', 'FAF': 'First American Financial Corporation',
  'ERIE': 'Erie Indemnity Company', 'RJF': 'Raymond James Financial Inc.', 'TROW': 'T. Rowe Price Group Inc.',
  'IVZ': 'Invesco Ltd.', 'JKHY': 'Jack Henry & Associates Inc.',
  
  // Additional Consumer & Retail
  'TGT': 'Target Corporation', 'DLTR': 'Dollar Tree Inc.', 'BBY': 'Best Buy Co. Inc.',
  'BJ': 'BJ\'s Wholesale Club Holdings Inc.',
  
  // Additional Industrials & Defense
  'HWM': 'Howmet Aerospace Inc.', 'TXT': 'Textron Inc.', 'AXON': 'Axon Enterprise Inc.', 'TT': 'Trane Technologies plc',
  
  // Additional Materials & Chemicals
  'RPM': 'RPM International Inc.'
};

// Complete S&P 500 tickers (as of January 2026)
const SP500_TICKERS = [
  // Technology & Communication Services
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL',
  'ADBE', 'CRM', 'CSCO', 'ACN', 'AMD', 'INTC', 'IBM', 'QCOM', 'TXN', 'INTU',
  'NOW', 'AMAT', 'ADI', 'LRCX', 'KLAC', 'SNPS', 'CDNS', 'MCHP', 'PANW', 'NXPI',
  'ADSK', 'FTNT', 'ANET', 'APH', 'MSI', 'TEL', 'ROP', 'PLTR', 'CRWD', 'APP',
  'NFLX', 'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'CHTR', 'EA', 'TTWO', 'NTES',
  
  // Financials
  'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'MS', 'GS', 'SPGI', 'BLK',
  'C', 'AXP', 'SCHW', 'BX', 'CB', 'MMC', 'PGR', 'AON', 'ICE', 'CME',
  'USB', 'TFC', 'PNC', 'COF', 'AIG', 'MET', 'PRU', 'AFL', 'ALL', 'TRV',
  'AJG', 'HIG', 'CINF', 'WRB', 'L', 'GL', 'BEN', 'STT', 'NTRS', 'KEY',
  'CFG', 'RF', 'FITB', 'HBAN', 'MTB', 'ZION', 'WBS', 'CMA', 'FRC', 'SIVB',
  
  // Healthcare
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'PFE', 'BMY',
  'AMGN', 'CVS', 'CI', 'MDT', 'GILD', 'VRTX', 'REGN', 'ISRG', 'BSX', 'SYK',
  'ELV', 'HUM', 'ZTS', 'EW', 'A', 'IDXX', 'MCK', 'CAH', 'COR', 'IQV',
  'DXCM', 'RMD', 'HCA', 'BDX', 'GEHC', 'BAX', 'MTD', 'ALGN', 'HOLX', 'STE',
  'PODD', 'DVA', 'WAT', 'ZBH', 'COO', 'TFX', 'TECH', 'INCY', 'BIIB', 'MRNA',
  
  // Consumer Discretionary
  'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'SBUX', 'TGT', 'TJX', 'BKNG',
  'CMG', 'ABNB', 'MAR', 'GM', 'F', 'HLT', 'ORLY', 'AZO', 'ROST', 'YUM',
  'DHI', 'LEN', 'PHM', 'NVR', 'GPC', 'DG', 'DLTR', 'TSCO', 'BBY', 'EBAY',
  'POOL', 'ULTA', 'DPZ', 'LVS', 'WYNN', 'MGM', 'CZR', 'NCLH', 'RCL', 'CCL',
  'TPR', 'RL', 'PVH', 'VFC', 'HBI', 'UAA', 'UA', 'DECK', 'CROX', 'SKX',
  
  // Industrials
  'UPS', 'HON', 'UNP', 'RTX', 'BA', 'CAT', 'DE', 'LMT', 'GE', 'MMM',
  'ADP', 'WM', 'ETN', 'ITW', 'NOC', 'EMR', 'PH', 'GD', 'TDG', 'CARR',
  'PCAR', 'JCI', 'CMI', 'FDX', 'NSC', 'CSX', 'WMB', 'IR', 'OTIS', 'AME',
  'FAST', 'PAYX', 'VRSK', 'ROK', 'DAL', 'UAL', 'LUV', 'AAL', 'GWW', 'SWK',
  'DOV', 'EXPD', 'CHRW', 'JBHT', 'XYL', 'IEX', 'LDOS', 'CTAS', 'URI', 'PWR',
  
  // Consumer Staples
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'PM', 'MO', 'CL', 'MDLZ', 'KMB',
  'GIS', 'ADM', 'HSY', 'SYY', 'KHC', 'CLX', 'K', 'CHD', 'MKC', 'TSN',
  'KR', 'SJM', 'CAG', 'CPB', 'HRL', 'LW', 'TAP', 'BF.B', 'STZ', 'DG',
  'MNST', 'KDP', 'EL', 'CLF', 'WBA', 'KMB', 'DPZ', 'HSY', 'TSN', 'HRL',
  
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'WMB',
  'HAL', 'HES', 'KMI', 'BKR', 'FANG', 'DVN', 'EQT', 'TRGP', 'LNG', 'CTRA',
  'MRO', 'APA', 'OKE', 'CHRD', 'FTI', 'NOV', 'CVE', 'HFC', 'OVV', 'PR',
  
  // Utilities
  'NEE', 'SO', 'DUK', 'D', 'AEP', 'SRE', 'EXC', 'XEL', 'ED', 'WEC',
  'ES', 'AWK', 'DTE', 'PEG', 'FE', 'EIX', 'ETR', 'PPL', 'AEE', 'CMS',
  'CNP', 'NI', 'LNT', 'EVRG', 'AES', 'PCG', 'NRG', 'VST', 'CEG', 'ATO',
  
  // Real Estate
  'PLD', 'AMT', 'EQIX', 'CCI', 'PSA', 'SPG', 'O', 'WELL', 'DLR', 'AVB',
  'EQR', 'VICI', 'VTR', 'SBAC', 'WY', 'ARE', 'INVH', 'ESS', 'MAA', 'EXR',
  'UDR', 'CPT', 'HST', 'REG', 'BXP', 'FRT', 'KIM', 'VNO', 'AIV', 'SLG',
  
  // Materials
  'LIN', 'APD', 'SHW', 'ECL', 'DD', 'NEM', 'FCX', 'DOW', 'NUE', 'VMC',
  'MLM', 'CTVA', 'ALB', 'IFF', 'BALL', 'AVY', 'PPG', 'EMN', 'MOS', 'CE',
  'FMC', 'IP', 'PKG', 'AMCR', 'SEE', 'CF', 'LYB', 'SW', 'WRK', 'STLD',
  
  // Additional Tech & Software
  'WDAY', 'DDOG', 'ZS', 'TEAM', 'SNOW', 'HUBS', 'BILL', 'CFLT', 'S', 'ZM',
  'OKTA', 'DOCU', 'TWLO', 'NET', 'COUP', 'VEEV', 'SPLK', 'MRVL', 'ON', 'MU',
  
  // Additional Healthcare & Biotech
  'MOH', 'VTRS', 'CRL', 'HSIC', 'DGX', 'SOLV', 'UHS', 'HUM', 'CNC', 'ANTM',
  'LH', 'TECH', 'TDOC', 'ILMN', 'EXAS', 'JAZZ', 'UTHR', 'NBIX', 'ALNY', 'IONS',
  
  // Additional Financials & Insurance
  'TROW', 'IVZ', 'ETFC', 'ALLY', 'DFS', 'SYF', 'NAVI', 'WBS', 'EWBC', 'FCNCA',
  'FDS', 'MKTX', 'MSCI', 'MCO', 'CBOE', 'NDAQ', 'PFG', 'RJF', 'JKHY', 'BR',
  
  // Additional Consumer & Retail
  'LULU', 'RH', 'WSM', 'W', 'CHWY', 'ETSY', 'FTCH', 'CVNA', 'BROS', 'WING',
  'TXRH', 'BLMN', 'EAT', 'BJRI', 'BWLD', 'DRI', 'QSR', 'MCD', 'WEN', 'JACK',
  
  // Additional Industrials & Defense
  'HWM', 'TXT', 'ALLE', 'BLDR', 'J', 'FLS', 'PNR', 'TT', 'MAS', 'GNRC',
  'AOS', 'HUBB', 'LDOS', 'HII', 'LHX', 'AXON', 'TDY', 'HEI', 'HEI.A', 'MOG.A',
  
  // Additional Materials & Chemicals
  'APD', 'ARG', 'AMKR', 'ATI', 'AVY', 'BLL', 'CLF', 'HUN', 'WLK', 'OLN',
  'OMC', 'IPG', 'NWSA', 'NWS', 'FOXA', 'FOX', 'PARA', 'WBD', 'DISH', 'SIRI'
];

async function populateSP500() {
  console.log('🏢 Populating S&P 500 stocks...\n');
  
  let created = 0;
  let updated = 0;
  let failed = 0;
  
  console.log(`Processing ${SP500_TICKERS.length} tickers...\n`);
  
  for (let i = 0; i < SP500_TICKERS.length; i++) {
    const ticker = SP500_TICKERS[i];
    
    try {
      console.log(`[${i + 1}/${SP500_TICKERS.length}] Fetching ${ticker}...`);
      
      // Get quote and profile from Finnhub (2 API calls per stock)
      const [quote, profile] = await Promise.all([
        finnhubService.getQuote(ticker),
        finnhubService.getCompanyProfile(ticker)
      ]);
      
      if (!quote) {
        console.log(`❌ Failed to get quote for ${ticker}`);
        failed++;
        continue;
      }
      
      // Use profile name if available, fallback to hardcoded mapping, then ticker
      const companyName = profile?.name || TICKER_NAMES[ticker] || ticker;
      const sector = profile?.sector || 'Unknown';
      const marketCap = profile?.marketCap || null;
      
      // Upsert asset in database
      const asset = await prisma.asset.upsert({
        where: { ticker },
        update: {
          currentPrice: quote.currentPrice,
          previousClose: quote.previousClose,
          name: companyName, // Update name too
          sector: sector,
          marketCap: marketCap,
          updatedAt: new Date(),
        },
        create: {
          ticker,
          name: companyName,
          type: 'Stock',
          tier: 'Tier 1', // Can be adjusted based on market cap
          currentPrice: quote.currentPrice,
          previousClose: quote.previousClose,
          sector: sector,
          marketCap: marketCap,
          isActive: true,
        },
      });
      
      if (asset.createdAt.getTime() === asset.updatedAt.getTime()) {
        console.log(`✅ Created ${ticker}: ${companyName} - $${quote.currentPrice.toFixed(2)}`);
        created++;
      } else {
        console.log(`✅ Updated ${ticker}: ${companyName} - $${quote.currentPrice.toFixed(2)}`);
        updated++;
      }
      
      // Rate limiting: 2 API calls per stock, 60 calls/min = ~2 seconds per stock
      if (i < SP500_TICKERS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2200));
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${ticker}:`, error);
      failed++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`✅ Created: ${created}`);
  console.log(`🔄 Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\n⏱️  Total time: ~${Math.round(SP500_TICKERS.length * 2.2 / 60)} minutes`);
}

populateSP500()
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
