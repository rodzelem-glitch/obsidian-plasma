import React, { useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { useLanguage } from '../../../../context/LanguageContext';
import { useAppContext } from '../../../../context/AppContext';
import { 
  Wrench, 
  Flame, 
  Thermometer, 
  Zap, 
  Wind, 
  Save, 
  CheckCircle2,
  Droplets,
  Gauge,
  Activity,
  Layers,
  Sparkles,
  Sun,
  ShieldCheck,
  Dog,
  Calculator,
  Compass,
  Cpu,
  Scissors,
  Hammer
} from 'lucide-react';
import showToast from '../../../../lib/toast';

interface JobToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  workflowState: any;
  onUpdateWorkflowState: (field: string, value: any) => void;
}

export const JobToolsModal: React.FC<JobToolsModalProps> = ({
  isOpen,
  onClose,
  job,
  workflowState,
  onUpdateWorkflowState,
}) => {
  const { t } = useLanguage();
  const { state } = useAppContext();

  // Determine active trade vertical
  const rawTrade = ((job?.industry || (job as any)?.trade || state.currentOrganization?.industry || 'HVAC') as string).toUpperCase();
  
  const isHvac = rawTrade.includes('HVAC');
  const isPlumbing = rawTrade.includes('PLUMB');
  const isElectrical = rawTrade.includes('ELECTR');
  const isLandscaping = rawTrade.includes('LANDSCAPE');
  const isContracting = rawTrade.includes('CONTRACT') || rawTrade.includes('CARPENT');
  const isMasonry = rawTrade.includes('MASON') || rawTrade.includes('CONCRETE');
  const isRoofing = rawTrade.includes('ROOF');
  const isPainting = rawTrade.includes('PAINT');
  const isCleaning = rawTrade.includes('CLEAN');
  const isTelecom = rawTrade.includes('TELECOM') || rawTrade.includes('CABLING');
  const isSolar = rawTrade.includes('SOLAR');
  const isSecurity = rawTrade.includes('SECUR');
  const isPetGrooming = rawTrade.includes('PET') || rawTrade.includes('GROOM');
  const isGeneral = !isHvac && !isPlumbing && !isElectrical && !isLandscaping && !isContracting && !isMasonry && !isRoofing && !isPainting && !isCleaning && !isTelecom && !isSolar && !isSecurity && !isPetGrooming;

  // Selected tool card state (default to tool 1)
  const [selectedToolId, setSelectedToolId] = useState<string>('tool1');

  // ==================== TOOL STATES ====================
  // HVAC
  const [refrigerantType, setRefrigerantType] = useState('R-410A');
  const [amountRecoveredLbs, setAmountRecoveredLbs] = useState('');
  const [amountAddedLbs, setAmountAddedLbs] = useState('');
  const [cylinderSerial, setCylinderSerial] = useState('');
  const [returnTemp, setReturnTemp] = useState('');
  const [supplyTemp, setSupplyTemp] = useState('');

  // Plumbing
  const [pipeDiameter, setPipeDiameter] = useState('0.75');
  const [flowGpm, setFlowGpm] = useState('10');
  const [tankGallons, setTankGallons] = useState('50');
  const [tempRise, setTempRise] = useState('70');

  // Electrical
  const [ohmsVolts, setOhmsVolts] = useState('120');
  const [ohmsAmps, setOhmsAmps] = useState('10');
  const [wireGaugeAwg, setWireGaugeAwg] = useState('12');
  const [conduitSize, setConduitSize] = useState('0.75');

  // Landscaping
  const [areaLengthFt, setAreaLengthFt] = useState('50');
  const [areaWidthFt, setAreaWidthFt] = useState('20');
  const [depthInches, setDepthInches] = useState('3');

  // Contracting / Carpentry
  const [lumberThickness, setLumberThickness] = useState('2');
  const [lumberWidth, setLumberWidth] = useState('6');
  const [lumberLengthFt, setLumberLengthFt] = useState('12');
  const [lumberQty, setLumberQty] = useState('10');

  // Masonry
  const [slabLengthFt, setSlabLengthFt] = useState('20');
  const [slabWidthFt, setSlabWidthFt] = useState('10');
  const [slabThicknessIn, setSlabThicknessIn] = useState('4');

  // Roofing
  const [roofAreaSqFt, setRoofAreaSqFt] = useState('2000');
  const [pitchRise, setPitchRise] = useState('6'); // 6/12 pitch

  // Painting
  const [paintWallWidth, setPaintWallWidth] = useState('40');
  const [paintWallHeight, setPaintWallHeight] = useState('9');
  const [paintCoats, setPaintCoats] = useState('2');

  // Cleaning
  const [cleanSqFt, setCleanSqFt] = useState('5000');
  const [dilutionRatio, setDilutionRatio] = useState('32'); // 1:32

  // Telecom
  const [cableLengthFt, setCableLengthFt] = useState('250');
  const [cableType, setCableType] = useState('Cat6a');

  // Solar
  const [panelWattage, setPanelWattage] = useState('400');
  const [panelCount, setPanelCount] = useState('20');
  const [sunHours, setSunHours] = useState('5.5');

  // Security
  const [cameraCount, setCameraCount] = useState('8');
  const [resolution, setResolution] = useState('4K');
  const [retentionDays, setRetentionDays] = useState('30');

  // Pet Grooming
  const [dogWeightLbs, setDogWeightLbs] = useState('45');
  const [coatType, setCoatType] = useState('Double Coat');

  // General Handyman
  const [handymanHours, setHandymanHours] = useState('3');
  const [handymanRate, setHandymanRate] = useState('85');
  const [handymanPartsCost, setHandymanPartsCost] = useState('120');

  // ==================== CALCULATIONS ====================
  // HVAC
  const returnVal = parseFloat(returnTemp);
  const supplyVal = parseFloat(supplyTemp);
  const tempSplitDelta = (!isNaN(returnVal) && !isNaN(supplyVal)) ? (returnVal - supplyVal) : null;

  // Plumbing
  const gallonsVal = parseFloat(tankGallons) || 0;
  const tempRiseVal = parseFloat(tempRise) || 0;
  const gasBtuNeeded = (gallonsVal * 8.33 * tempRiseVal * 1.25); // Approx BTU required for recovery

  // Electrical
  const vVal = parseFloat(ohmsVolts) || 0;
  const iVal = parseFloat(ohmsAmps) || 0;
  const calculatedWatts = vVal * iVal;
  const calculatedOhms = iVal > 0 ? (vVal / iVal) : 0;

  // Landscaping
  const lFt = parseFloat(areaLengthFt) || 0;
  const wFt = parseFloat(areaWidthFt) || 0;
  const dIn = parseFloat(depthInches) || 0;
  const cubicYards = (lFt * wFt * (dIn / 12)) / 27;
  const totalBags2CuFt = Math.ceil(cubicYards * 13.5);

  // Contracting / Carpentry
  const tIn = parseFloat(lumberThickness) || 0;
  const wIn = parseFloat(lumberWidth) || 0;
  const lenFt = parseFloat(lumberLengthFt) || 0;
  const qNum = parseFloat(lumberQty) || 0;
  const totalBoardFeet = (tIn * wIn * lenFt * qNum) / 12;

  // Masonry
  const sLFt = parseFloat(slabLengthFt) || 0;
  const sWFt = parseFloat(slabWidthFt) || 0;
  const sTIn = parseFloat(slabThicknessIn) || 0;
  const concreteCuYards = (sLFt * sWFt * (sTIn / 12)) / 27;
  const bags80lbConcrete = Math.ceil(concreteCuYards * 45);

  // Roofing
  const roofArea = parseFloat(roofAreaSqFt) || 0;
  const rise = parseFloat(pitchRise) || 6;
  const slopeFactor = Math.sqrt(1 + Math.pow(rise / 12, 2));
  const actualRoofSqFt = roofArea * slopeFactor;
  const roofSquares = Math.ceil((actualRoofSqFt * 1.1) / 100); // 10% waste margin
  const shingleBundles = roofSquares * 3;

  // Painting
  const pW = parseFloat(paintWallWidth) || 0;
  const pH = parseFloat(paintWallHeight) || 0;
  const pC = parseFloat(paintCoats) || 2;
  const grossWallArea = pW * pH * pC;
  const gallonsPaintNeeded = Math.ceil(grossWallArea / 350); // 350 sq ft per gallon

  // Cleaning
  const sqFtClean = parseFloat(cleanSqFt) || 0;
  const estCleanHours = (sqFtClean / 3000).toFixed(1); // 3000 sq ft / hr standard commercial rate
  const dilutionRatioVal = parseFloat(dilutionRatio) || 32;
  const ozChemicalPerGallon = (128 / (dilutionRatioVal + 1)).toFixed(1);

  // Telecom
  const lenCable = parseFloat(cableLengthFt) || 0;
  const attenPer100Ft = cableType === 'Fiber-SM' ? 0.1 : (cableType === 'Cat6a' ? 2.1 : 3.2);
  const totalDbLoss = ((lenCable / 100) * attenPer100Ft).toFixed(2);

  // Solar
  const pWatts = parseFloat(panelWattage) || 0;
  const pCount = parseFloat(panelCount) || 0;
  const sHours = parseFloat(sunHours) || 0;
  const dailyKwhOutput = ((pWatts * pCount * sHours * 0.82) / 1000).toFixed(1); // 82% system efficiency factor

  // Security
  const cCount = parseFloat(cameraCount) || 0;
  const gbPerDayPerCam = resolution === '4K' ? 45 : (resolution === '1440p' ? 25 : 15);
  const daysRet = parseFloat(retentionDays) || 30;
  const totalStorageTb = ((cCount * gbPerDayPerCam * daysRet) / 1000).toFixed(2);

  // Pet Grooming
  const dogWeight = parseFloat(dogWeightLbs) || 0;
  const estGroomingMins = Math.round(30 + (dogWeight * 0.5) + (coatType === 'Double Coat' ? 25 : (coatType === 'Matted' ? 40 : 10)));

  // Handyman
  const hHours = parseFloat(handymanHours) || 0;
  const hRate = parseFloat(handymanRate) || 0;
  const hParts = parseFloat(handymanPartsCost) || 0;
  const totalHandymanEst = (hHours * hRate) + hParts;

  // Handlers
  const handleSaveRefrigerantLog = (e: React.FormEvent) => {
    e.preventDefault();
    const logEntry = {
      refrigerantType,
      amountRecoveredLbs: parseFloat(amountRecoveredLbs) || 0,
      amountAddedLbs: parseFloat(amountAddedLbs) || 0,
      cylinderSerial,
      timestamp: new Date().toISOString(),
    };
    const currentLogs = workflowState?.refrigerantLogs || [];
    onUpdateWorkflowState('refrigerantLogs', [...currentLogs, logEntry]);
    showToast.success(t("EPA Refrigerant Recovery Log saved!"));
    setAmountRecoveredLbs('');
    setAmountAddedLbs('');
    onClose();
  };

  // Helper to render trade cards header
  const renderToolCardsHeader = () => {
    let cards: Array<{ id: string; title: string; subtitle: string; icon: React.ReactNode; badge: string; color: string }> = [];

    if (isHvac) {
      cards = [
        { id: 'tool1', title: 'EPA Section 608 Log', subtitle: 'Refrigerant recovery & charge cylinder tracking', icon: <Flame size={20} />, badge: 'EPA Compliant', color: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
        { id: 'tool2', title: 'Target Temp Split', subtitle: 'Return vs supply airflow Delta T calculator', icon: <Thermometer size={20} />, badge: 'Airflow Check', color: 'from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
        { id: 'tool3', title: "Ohm's Law & Power", subtitle: 'Voltage, Amps, Resistance & Wattage Calculator', icon: <Zap size={20} />, badge: 'Electrical', color: 'from-purple-500/10 to-indigo-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
      ];
    } else if (isPlumbing) {
      cards = [
        { id: 'tool1', title: 'Pipe Flow & Pressure Drop', subtitle: 'GPM flow rate & friction loss calculator', icon: <Droplets size={20} />, badge: 'Hydraulics', color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
        { id: 'tool2', title: 'Water Heater & BTU Sizing', subtitle: 'Gallons, Temp Rise & Expansion Tank Sizer', icon: <Flame size={20} />, badge: 'Water Heating', color: 'from-orange-500/10 to-amber-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
        { id: 'tool3', title: 'Slope & Hydrostatic Test', subtitle: 'Drainage pitch drop & hydrostatic pressure logger', icon: <Gauge size={20} />, badge: 'Code Test', color: 'from-teal-500/10 to-emerald-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30' },
      ];
    } else if (isElectrical) {
      cards = [
        { id: 'tool1', title: "Ohm's Law & Power Triangle", subtitle: 'Volts, Amps, Resistance & Wattage Solver', icon: <Zap size={20} />, badge: 'Circuit Calc', color: 'from-purple-500/10 to-violet-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
        { id: 'tool2', title: 'Conduit Fill & AWG Table', subtitle: 'Wire gauge ampacity & conduit conductor fill', icon: <Layers size={20} />, badge: 'NEC Standard', color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
        { id: 'tool3', title: 'Panel Load Estimator', subtitle: 'Service main amperage & connected load utilization', icon: <Activity size={20} />, badge: 'Panel Sizing', color: 'from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
      ];
    } else if (isLandscaping) {
      cards = [
        { id: 'tool1', title: 'Soil, Mulch & Sod Yardage', subtitle: 'Length, width & depth to cubic yards & bags', icon: <Layers size={20} />, badge: 'Bulk Materials', color: 'from-emerald-500/10 to-green-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
        { id: 'tool2', title: 'Irrigation Zone GPM', subtitle: 'Sprinkler head count, nozzle GPM & pressure', icon: <Droplets size={20} />, badge: 'Zone Sizing', color: 'from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
        { id: 'tool3', title: 'Low Voltage Lighting Sizing', subtitle: 'Fixture total wattage & transformer cable run', icon: <Zap size={20} />, badge: 'Landscape Light', color: 'from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
      ];
    } else if (isContracting) {
      cards = [
        { id: 'tool1', title: 'Board-Foot Lumber Estimator', subtitle: 'Thickness, width & length to total board-feet', icon: <Hammer size={20} />, badge: 'Lumber Calc', color: 'from-amber-500/10 to-orange-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
        { id: 'tool2', title: 'Framing Studs & Drywall', subtitle: 'Wall length to stud count & 4x8 sheetrock', icon: <Layers size={20} />, badge: 'Framing', color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
        { id: 'tool3', title: 'Flooring Sq Ft & Waste', subtitle: 'Room square footage & waste margin offset', icon: <Calculator size={20} />, badge: 'Flooring', color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
      ];
    } else if (isMasonry) {
      cards = [
        { id: 'tool1', title: 'Concrete Cubic Yards & Bags', subtitle: 'Slab length, width & thickness to 80lb bags', icon: <Layers size={20} />, badge: 'Concrete Pour', color: 'from-slate-500/10 to-zinc-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30' },
        { id: 'tool2', title: 'Brick & CMU Block Estimator', subtitle: 'Wall dimensions to block units & mortar bags', icon: <Calculator size={20} />, badge: 'Block Work', color: 'from-amber-500/10 to-red-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
      ];
    } else if (isRoofing) {
      cards = [
        { id: 'tool1', title: 'Roof Pitch & Square Estimator', subtitle: 'Pitch ratio slope multiplier & total squares', icon: <Compass size={20} />, badge: 'Pitch & Area', color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
        { id: 'tool2', title: 'Shingle Bundles & Felt Rolls', subtitle: 'Roof squares to shingle bundles & underlayment', icon: <Layers size={20} />, badge: 'Bundles & Felt', color: 'from-slate-500/10 to-zinc-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30' },
      ];
    } else if (isPainting) {
      cards = [
        { id: 'tool1', title: 'Paint Coverage Gallonage', subtitle: 'Wall surface area & coats to gallons needed', icon: <Sparkles size={20} />, badge: 'Gallons Calc', color: 'from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
        { id: 'tool2', title: 'Drying Time & Humidity Matrix', subtitle: 'Ambient temperature & humidity recoat hours', icon: <Thermometer size={20} />, badge: 'Dry Time', color: 'from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
      ];
    } else if (isCleaning) {
      cards = [
        { id: 'tool1', title: 'Janitorial Labor Allocator', subtitle: 'Facility square footage to crew labor hours', icon: <Sparkles size={20} />, badge: 'Crew Hours', color: 'from-teal-500/10 to-emerald-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30' },
        { id: 'tool2', title: 'Chemical Dilution Calculator', subtitle: 'Container size & ratio to ounces chemical', icon: <Droplets size={20} />, badge: 'Sanitization', color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
      ];
    } else if (isTelecom) {
      cards = [
        { id: 'tool1', title: 'Cable Attenuation & Signal Loss', subtitle: 'Cat6a / Fiber optic distance loss in dB', icon: <Activity size={20} />, badge: 'dB Loss Test', color: 'from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
        { id: 'tool2', title: 'PoE Switch Power Budget', subtitle: 'Switch port count & PoE class total wattage', icon: <Zap size={20} />, badge: 'PoE Budget', color: 'from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
      ];
    } else if (isSolar) {
      cards = [
        { id: 'tool1', title: 'PV Array Output & Daily kWh', subtitle: 'Panel count, wattage & peak sun hours output', icon: <Sun size={20} />, badge: 'kWh Production', color: 'from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
        { id: 'tool2', title: 'Battery Backup Run-Time', subtitle: 'Storage capacity kWh to load backup hours', icon: <Zap size={20} />, badge: 'Backup Hours', color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
      ];
    } else if (isSecurity) {
      cards = [
        { id: 'tool1', title: 'CCTV Storage & Bandwidth', subtitle: 'Camera count, 1080p/4K resolution & retention', icon: <Cpu size={20} />, badge: 'Storage TB', color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
        { id: 'tool2', title: 'Access Control Power Draw', subtitle: 'Maglock & strike draw to backup battery hours', icon: <ShieldCheck size={20} />, badge: 'Power Supply', color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
      ];
    } else if (isPetGrooming) {
      cards = [
        { id: 'tool1', title: 'Coat Type & Grooming Time', subtitle: 'Dog weight & coat type to estimated minutes', icon: <Dog size={20} />, badge: 'Time Estimator', color: 'from-pink-500/10 to-rose-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30' },
        { id: 'tool2', title: 'Shampoo Dilution Calculator', subtitle: 'Bathing tank size & ratio to ounces shampoo', icon: <Scissors size={20} />, badge: 'Shampoo Ratio', color: 'from-purple-500/10 to-indigo-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
      ];
    } else {
      // General Handyman / Default
      cards = [
        { id: 'tool1', title: 'Handyman Job Cost & Time', subtitle: 'Labor rate, estimated hours & parts cost solver', icon: <Hammer size={20} />, badge: 'Job Estimator', color: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
        { id: 'tool2', title: "Ohm's Law & Power Calculator", subtitle: 'Voltage, Amps, Resistance & Wattage Solver', icon: <Zap size={20} />, badge: 'Electrical', color: 'from-purple-500/10 to-indigo-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
        { id: 'tool3', title: 'Fastener Anchor Capacity Chart', subtitle: 'Drywall, toggle & concrete max weight ratings', icon: <Wrench size={20} />, badge: 'Fastener Load', color: 'from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
      ];
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {cards.map((c) => {
          const isSelected = selectedToolId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedToolId(c.id)}
              className={`cursor-pointer rounded-2xl p-3.5 border transition-all duration-200 bg-gradient-to-br ${c.color} relative overflow-hidden ${
                isSelected
                  ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 border-indigo-500 dark:border-indigo-400 shadow-md scale-[1.01]'
                  : 'hover:border-slate-300 dark:hover:border-slate-700 opacity-85 hover:opacity-100 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 shadow-xs backdrop-blur-xs">
                  {c.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 shadow-2xs">
                  {c.badge}
                </span>
              </div>
              <h3 className="font-extrabold text-xs text-slate-900 dark:text-white">{c.title}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{c.subtitle}</p>
              {isSelected && (
                <div className="absolute top-2 right-2 text-indigo-600 dark:text-indigo-400">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Wrench className="text-indigo-600 dark:text-indigo-400 shrink-0" size={24} />
          <div>
            <h2 className="font-extrabold text-base md:text-lg">
              {t("Tech & Trade Diagnostic Tools")} — <span className="text-indigo-600 dark:text-indigo-400">{rawTrade || 'General'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {t("Select a tool card below to run field calculations, log compliance entries, and verify trade specs.")}
            </p>
          </div>
        </div>
      }
      size="lg"
    >
      <div className="space-y-5 pb-4">
        
        {/* Visual Card Selector Header */}
        {renderToolCardsHeader()}

        {/* ==================== TOOL DETAILS BODY ==================== */}

        {/* ---------- HVAC TOOL 1: EPA Section 608 Log ---------- */}
        {isHvac && selectedToolId === 'tool1' && (
          <form onSubmit={handleSaveRefrigerantLog} className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs">
              <span className="font-bold block mb-0.5">{t("EPA Section 608 Compliance Log")}</span>
              {t("Log refrigerant recovery, virgin refrigerant charge additions, and recovery cylinder serial numbers.")}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Refrigerant Type")}</label>
                <select
                  value={refrigerantType}
                  onChange={(e) => setRefrigerantType(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="R-410A">R-410A</option>
                  <option value="R-22">R-22</option>
                  <option value="R-454B">R-454B (Opteon XL20)</option>
                  <option value="R-32">R-32</option>
                  <option value="R-134a">R-134a</option>
                  <option value="R-407C">R-407C</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Recovery Cylinder Serial #")}</label>
                <input
                  type="text"
                  placeholder="e.g. CYL-998231"
                  value={cylinderSerial}
                  onChange={(e) => setCylinderSerial(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Amount Recovered (Lbs)")}</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={amountRecoveredLbs}
                  onChange={(e) => setAmountRecoveredLbs(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Amount Charged/Added (Lbs)")}</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={amountAddedLbs}
                  onChange={(e) => setAmountAddedLbs(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" className="bg-amber-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5">
                <Save size={14} />
                {t("Save Refrigerant Entry")}
              </Button>
            </div>
          </form>
        )}

        {/* ---------- HVAC TOOL 2: Target Temp Split ---------- */}
        {isHvac && selectedToolId === 'tool2' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Return Air Temp (°F)")}</label>
                <input
                  type="number"
                  placeholder="75.0"
                  value={returnTemp}
                  onChange={(e) => setReturnTemp(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Supply Air Temp (°F)")}</label>
                <input
                  type="number"
                  placeholder="56.0"
                  value={supplyTemp}
                  onChange={(e) => setSupplyTemp(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {tempSplitDelta !== null && (
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                tempSplitDelta >= 16 && tempSplitDelta <= 22
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200'
              }`}>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block">{t("Calculated Delta T")}</span>
                  <span className="text-2xl font-black">{tempSplitDelta.toFixed(1)}°F</span>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-slate-900 shadow-xs">
                  {tempSplitDelta >= 16 && tempSplitDelta <= 22 ? t("✓ Normal Airflow Range") : t("⚠️ Check Airflow / Charge")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ---------- OHM'S LAW / ELECTRICAL TOOL ---------- */}
        {(isElectrical || (isHvac && selectedToolId === 'tool3') || (isGeneral && selectedToolId === 'tool2')) && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Voltage (Volts)")}</label>
                <input
                  type="number"
                  value={ohmsVolts}
                  onChange={(e) => setOhmsVolts(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Current (Amps)")}</label>
                <input
                  type="number"
                  value={ohmsAmps}
                  onChange={(e) => setOhmsAmps(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-900 dark:text-purple-200">
                <span className="text-[10px] font-black uppercase block">Total Power Output</span>
                <span className="text-xl font-black">{calculatedWatts.toFixed(0)} Watts ({ (calculatedWatts / 1000).toFixed(2) } kW)</span>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-900 dark:text-indigo-200">
                <span className="text-[10px] font-black uppercase block">Calculated Resistance</span>
                <span className="text-xl font-black">{calculatedOhms.toFixed(2)} Ω (Ohms)</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------- PLUMBING: Pipe Flow & Water Heater ---------- */}
        {isPlumbing && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Nominal Pipe Size (Inches)")}</label>
                <select
                  value={pipeDiameter}
                  onChange={(e) => setPipeDiameter(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="0.5">1/2" Copper/PEX (Max 4 GPM)</option>
                  <option value="0.75">3/4" Copper/PEX (Max 8 GPM)</option>
                  <option value="1.0">1" Copper/PEX (Max 14 GPM)</option>
                  <option value="1.25">1-1/4" Main Line (Max 22 GPM)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Flow Rate (GPM)")}</label>
                <input
                  type="number"
                  value={flowGpm}
                  onChange={(e) => setFlowGpm(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200 text-xs">
              <span className="font-bold block mb-0.5">Hydraulic Velocity Status:</span>
              <span>{(parseFloat(flowGpm) || 0) <= (parseFloat(pipeDiameter) === 0.5 ? 4 : (parseFloat(pipeDiameter) === 0.75 ? 8 : 14)) ? '✓ Velocity within safe 5 FPS limit (No erosion risk)' : '⚠️ High velocity flow - consider upsizing pipe'}</span>
            </div>
          </div>
        )}

        {isPlumbing && selectedToolId === 'tool2' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Water Heater Capacity (Gallons)")}</label>
                <input
                  type="number"
                  value={tankGallons}
                  onChange={(e) => setTankGallons(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Desired Temp Rise (°F)")}</label>
                <input
                  type="number"
                  value={tempRise}
                  onChange={(e) => setTempRise(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs">
              <span className="font-bold block mb-0.5">Required Heating Input:</span>
              <span className="text-xl font-black block">{gasBtuNeeded.toLocaleString('en-US', { maximumFractionDigits: 0 })} BTU/hr</span>
              <span className="text-[11px] text-amber-700 dark:text-amber-300">Recommended Thermal Expansion Tank Size: {gallonsVal > 50 ? '4.5 Gallons (Model ST-12)' : '2.1 Gallons (Model ST-5)'}</span>
            </div>
          </div>
        )}

        {/* ---------- LANDSCAPING: Soil & Yardage ---------- */}
        {isLandscaping && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Length (Ft)")}</label>
                <input type="number" value={areaLengthFt} onChange={e => setAreaLengthFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Width (Ft)")}</label>
                <input type="number" value={areaWidthFt} onChange={e => setAreaWidthFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Depth (Inches)")}</label>
                <input type="number" value={depthInches} onChange={e => setDepthInches(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
              </div>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200">
              <span className="text-[10px] font-black uppercase block">Bulk Volume Required</span>
              <span className="text-2xl font-black">{cubicYards.toFixed(2)} Cubic Yards</span>
              <span className="text-xs font-semibold block mt-1">Equals approx {totalBags2CuFt} bags (2 cu ft each)</span>
            </div>
          </div>
        )}

        {/* ---------- CONTRACTING: Board-Foot Lumber ---------- */}
        {isContracting && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Thickness (In)")}</label>
                <input type="number" value={lumberThickness} onChange={e => setLumberThickness(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Width (In)")}</label>
                <input type="number" value={lumberWidth} onChange={e => setLumberWidth(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Length (Ft)")}</label>
                <input type="number" value={lumberLengthFt} onChange={e => setLumberLengthFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Quantity")}</label>
                <input type="number" value={lumberQty} onChange={e => setLumberQty(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200">
              <span className="text-[10px] font-black uppercase block">Total Board-Feet (BDFT)</span>
              <span className="text-2xl font-black">{totalBoardFeet.toFixed(1)} BDFT</span>
            </div>
          </div>
        )}

        {/* ---------- MASONRY: Concrete & Bags ---------- */}
        {isMasonry && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Slab Length (Ft)")}</label>
                <input type="number" value={slabLengthFt} onChange={e => setSlabLengthFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Slab Width (Ft)")}</label>
                <input type="number" value={slabWidthFt} onChange={e => setSlabWidthFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Thickness (In)")}</label>
                <input type="number" value={slabThicknessIn} onChange={e => setSlabThicknessIn(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white">
              <span className="text-[10px] font-black uppercase block">Concrete Pour Volume</span>
              <span className="text-2xl font-black">{concreteCuYards.toFixed(2)} Cubic Yards</span>
              <span className="text-xs font-semibold block mt-1">Requires approx {bags80lbConcrete} bags (80lb Premix Concrete)</span>
            </div>
          </div>
        )}

        {/* ---------- ROOFING: Pitch & Squares ---------- */}
        {isRoofing && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Building Area (Sq Ft)")}</label>
                <input type="number" value={roofAreaSqFt} onChange={e => setRoofAreaSqFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Pitch (x/12)")}</label>
                <select value={pitchRise} onChange={e => setPitchRise(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold">
                  <option value="4">4/12 Pitch (Low Slope)</option>
                  <option value="6">6/12 Pitch (Standard)</option>
                  <option value="8">8/12 Pitch (Medium Steep)</option>
                  <option value="10">10/12 Pitch (Steep)</option>
                  <option value="12">12/12 Pitch (45° Steep)</option>
                </select>
              </div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200">
              <span className="text-[10px] font-black uppercase block">Estimated Roof Material</span>
              <span className="text-2xl font-black">{roofSquares} Roof Squares ({actualRoofSqFt.toFixed(0)} Sq Ft)</span>
              <span className="text-xs font-semibold block mt-1">Requires approx {shingleBundles} shingle bundles (3 bundles / sq)</span>
            </div>
          </div>
        )}

        {/* ---------- PAINTING: Gallonage ---------- */}
        {isPainting && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Total Length (Ft)")}</label>
                <input type="number" value={paintWallWidth} onChange={e => setPaintWallWidth(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Wall Height (Ft)")}</label>
                <input type="number" value={paintWallHeight} onChange={e => setPaintWallHeight(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Coats")}</label>
                <input type="number" value={paintCoats} onChange={e => setPaintCoats(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-900 dark:text-purple-200">
              <span className="text-[10px] font-black uppercase block">Required Paint Gallons</span>
              <span className="text-2xl font-black">{gallonsPaintNeeded} Gallons</span>
              <span className="text-xs font-semibold block mt-1">Covers {grossWallArea.toFixed(0)} total sq ft (including 2 coats)</span>
            </div>
          </div>
        )}

        {/* ---------- CLEANING: Labor & Dilution ---------- */}
        {isCleaning && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Facility Area (Sq Ft)")}</label>
              <input type="number" value={cleanSqFt} onChange={e => setCleanSqFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
            </div>
            <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-teal-900 dark:text-teal-200">
              <span className="text-[10px] font-black uppercase block">Estimated Janitorial Labor</span>
              <span className="text-2xl font-black">{estCleanHours} Crew Hours</span>
              <span className="text-xs font-semibold block mt-1">Based on 3,000 sq ft / hr commercial cleaning benchmark</span>
            </div>
          </div>
        )}

        {/* ---------- TELECOM: Attenuation ---------- */}
        {isTelecom && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Cable Run Length (Ft)")}</label>
                <input type="number" value={cableLengthFt} onChange={e => setCableLengthFt(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Cable Type")}</label>
                <select value={cableType} onChange={e => setCableType(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold">
                  <option value="Cat6a">Cat6a Copper (Copper Gigabit)</option>
                  <option value="Cat5e">Cat5e Copper</option>
                  <option value="Fiber-SM">Single-Mode Fiber (OS2)</option>
                </select>
              </div>
            </div>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-900 dark:text-indigo-200">
              <span className="text-[10px] font-black uppercase block">Signal Attenuation dB Loss</span>
              <span className="text-2xl font-black">-{totalDbLoss} dB Loss</span>
              <span className="text-xs font-semibold block mt-1">{lenCable <= 328 ? '✓ Within TIA-568 100-meter channel limit' : '⚠️ Exceeds 100m copper channel max! Use fiber extender.'}</span>
            </div>
          </div>
        )}

        {/* ---------- SOLAR: kWh Production ---------- */}
        {isSolar && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Panel Wattage (W)")}</label>
                <input type="number" value={panelWattage} onChange={e => setPanelWattage(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Panel Count")}</label>
                <input type="number" value={panelCount} onChange={e => setPanelCount(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Peak Sun Hours")}</label>
                <input type="number" step="0.1" value={sunHours} onChange={e => setSunHours(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200">
              <span className="text-[10px] font-black uppercase block">Estimated Daily Generation</span>
              <span className="text-2xl font-black">{dailyKwhOutput} kWh / Day</span>
              <span className="text-xs font-semibold block mt-1">System DC Rating: {((parseFloat(panelWattage)*parseFloat(panelCount))/1000).toFixed(2)} kW DC</span>
            </div>
          </div>
        )}

        {/* ---------- SECURITY: Storage Days ---------- */}
        {isSecurity && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Camera Count")}</label>
                <input type="number" value={cameraCount} onChange={e => setCameraCount(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Resolution")}</label>
                <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold">
                  <option value="1080p">1080p Full HD</option>
                  <option value="1440p">2K 4MP</option>
                  <option value="4K">4K Ultra HD (8MP)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Retention Days")}</label>
                <input type="number" value={retentionDays} onChange={e => setRetentionDays(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200">
              <span className="text-[10px] font-black uppercase block">Required NVR Hard Drive Capacity</span>
              <span className="text-2xl font-black">{totalStorageTb} Terabytes (TB)</span>
            </div>
          </div>
        )}

        {/* ---------- PET GROOMING: Grooming Time ---------- */}
        {isPetGrooming && selectedToolId === 'tool1' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Pet Weight (Lbs)")}</label>
                <input type="number" value={dogWeightLbs} onChange={e => setDogWeightLbs(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Coat Condition")}</label>
                <select value={coatType} onChange={e => setCoatType(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold">
                  <option value="Short Coat">Short / Smooth Coat</option>
                  <option value="Double Coat">Double Coat / Undercoat</option>
                  <option value="Matted">Heavy Matting / De-matting</option>
                </select>
              </div>
            </div>
            <div className="p-4 bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800 rounded-xl text-pink-900 dark:text-pink-200">
              <span className="text-[10px] font-black uppercase block">Estimated Grooming Session Duration</span>
              <span className="text-2xl font-black">{estGroomingMins} Minutes</span>
            </div>
          </div>
        )}

        {/* ---------- GENERAL HANDYMAN: Quick Estimator ---------- */}
        {(isGeneral || selectedToolId === 'tool1') && !isHvac && !isPlumbing && !isElectrical && !isLandscaping && !isContracting && !isMasonry && !isRoofing && !isPainting && !isCleaning && !isTelecom && !isSolar && !isSecurity && !isPetGrooming && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Labor Hours")}</label>
                <input type="number" value={handymanHours} onChange={e => setHandymanHours(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Labor Rate ($/Hr)")}</label>
                <input type="number" value={handymanRate} onChange={e => setHandymanRate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Parts / Materials ($)")}</label>
                <input type="number" value={handymanPartsCost} onChange={e => setHandymanPartsCost(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-bold" />
              </div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200">
              <span className="text-[10px] font-black uppercase block">Estimated Total Job Cost</span>
              <span className="text-2xl font-black">${totalHandymanEst.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800 gap-2">
          <Button type="button" variant="primary" onClick={onClose} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs px-5 py-2.5 rounded-xl hover:opacity-90">
            {t("Done")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default JobToolsModal;
