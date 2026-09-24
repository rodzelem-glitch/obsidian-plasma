/**
 * Impact Service Group Directory & Client Allocation Matrix
 * 
 * Single Source of Truth for all Impact Service Group Account Managers,
 * Project Coordinators, Department Personnel, and Brand Assignments.
 */

export interface ImpactPersonnel {
    name: string;
    department: 'Operations' | 'Vendor Management' | 'Finance' | 'Preventive Maintenance' | 'Executive' | 'Data';
    title: string;
    extension?: string;
    directPhone?: string;
    email: string;
    isAccountManager?: boolean;
    isProjectCoordinator?: boolean;
}

export interface ImpactBrandMapping {
    client: string;
    keywords: string[];
    accountManagerName: string | null;
    projectCoordinatorName: string | null;
}

export const IMPACT_GENERAL_INFO = {
    companyName: 'Impact Service Group, LLC',
    mainPhone: '800-719-1994',
    localPhone: '203-431-8008',
    dispatchEmail: 'dispatch@impactservicegroup.com',
    emergencyPhone: '203-902-7117',
    emergencyExtension: '7',
    vendorAdminEmail: 'vendoradmin@impactservicegroup.com',
    invoicingEmail: 'invoicing@impactservicegroup.com',
    serviceEmail: 'service@impactservicegroup.com',
    financeEmail: 'finance@impactservicegroup.com'
};

export const IMPACT_PERSONNEL_DIRECTORY: ImpactPersonnel[] = [
    // Executive & Data
    {
        name: 'Richard Wetchler',
        department: 'Operations',
        title: 'Founder & CGO',
        extension: '114',
        directPhone: '(203) 431-8008',
        email: 'rwetchler@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Scott Truman',
        department: 'Operations',
        title: 'General Manager',
        extension: '920',
        directPhone: '(203) 431-8008',
        email: 'struman@impactservicegroup.com'
    },
    {
        name: 'Michael Catuccio',
        department: 'Data',
        title: 'Data Analyst',
        extension: '152',
        directPhone: '203-902-7757',
        email: 'mcatuccio@impactservicegroup.com'
    },

    // Operations Department - Account Managers & Project Coordinators
    {
        name: 'Scott McPherson',
        department: 'Operations',
        title: 'Director of Account Management',
        extension: '122',
        directPhone: '(203) 548 8008',
        email: 'smcpherson@impactservicegroup.com',
        isAccountManager: true,
        isProjectCoordinator: true
    },
    {
        name: 'Anderson Graham',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '176',
        directPhone: '(203) 350-2522',
        email: 'agraham@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Brendan Corris',
        department: 'Operations',
        title: 'Account Manager',
        extension: '146',
        directPhone: '(203) 548-8040',
        email: 'bcorris@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Brendan Mahan',
        department: 'Operations',
        title: 'Account Manager',
        extension: '124',
        directPhone: '(203) 548 8042',
        email: 'bmahan@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Brianna Reynolds',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '934',
        directPhone: '(203) 548-8053',
        email: 'breynolds@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Chris Rhone',
        department: 'Operations',
        title: 'Account Manager',
        extension: '168',
        directPhone: '(860) 590-4004',
        email: 'crhone@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Caroline Bernstein',
        department: 'Operations',
        title: 'Senior Project Coordinator',
        extension: '153',
        directPhone: '(203) 902-7995',
        email: 'cbernstein@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Chris Bradley',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '931',
        directPhone: '(203) 548-8039',
        email: 'cbradley@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Dominick Cavoto',
        department: 'Operations',
        title: 'Account Manager',
        extension: '123',
        directPhone: '(203) 548 8045',
        email: 'dcavoto@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Douglas Noe',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '157',
        directPhone: '(203) 403-7308',
        email: 'dnoe@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Douglas Peet',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '167',
        directPhone: '(203) 548-8072',
        email: 'dpeet@impactservicegroup.com',
        isAccountManager: true,
        isProjectCoordinator: true
    },
    {
        name: 'Elisa Overlock',
        department: 'Operations',
        title: 'Account Manager',
        extension: '118',
        directPhone: '(203) 548 8055',
        email: 'eoverlock@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Giacomo Micciari',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '173',
        directPhone: '(203) 902-7755',
        email: 'gmicciari@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Jevon Pintard',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '170',
        directPhone: '(203) 428-3955',
        email: 'jpintard@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Joe Greenfield',
        department: 'Operations',
        title: 'Senior Account Manager',
        extension: '175',
        directPhone: '(203) 286-3930',
        email: 'jgreenfield@impactservicegroup.com',
        isAccountManager: true,
        isProjectCoordinator: true
    },
    {
        name: 'Keith Sherling',
        department: 'Operations',
        title: 'Account Manager',
        extension: '130',
        directPhone: '(203) 548-8069',
        email: 'ksherling@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'LaToya Evans',
        department: 'Operations',
        title: 'Account Manager',
        extension: '151',
        directPhone: '(203) 548-8064',
        email: 'levans@impactservicegroup.com',
        isAccountManager: true,
        isProjectCoordinator: true
    },
    {
        name: 'Makeba Freeman',
        department: 'Operations',
        title: 'Senior Account Manager',
        extension: '148',
        directPhone: '(203) 548 8071',
        email: 'mfreeman@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Mathew Flavin',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '172',
        directPhone: '(203) 428-3951',
        email: 'mflavin@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Mary Anthony',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '154',
        directPhone: '(203) 712-8270',
        email: 'manthony@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Samantha Wolf',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '143',
        directPhone: '(203) 489-5005',
        email: 'swolf@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Sharon Peck',
        department: 'Operations',
        title: 'Account Manager',
        extension: '128',
        directPhone: '(203) 548-8096',
        email: 'speck@impactservicegroup.com',
        isAccountManager: true
    },
    {
        name: 'Sinai Jordan',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '929',
        directPhone: '800-719-1994',
        email: 'sjordan@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Stanley Luciuk',
        department: 'Operations',
        title: 'Project Coordinator',
        extension: '930',
        directPhone: '(203) 292-0663',
        email: 'sluciuk@impactservicegroup.com',
        isProjectCoordinator: true
    },

    // Vendor Management Dept.
    {
        name: 'Mark Benson',
        department: 'Vendor Management',
        title: 'Founder / Chief Operating Officer',
        extension: '116',
        directPhone: '(203) 431-8008',
        email: 'mbenson@impactservicegroup.com'
    },
    {
        name: 'Philip Chiaia',
        department: 'Vendor Management',
        title: 'Director of Vendor Management',
        extension: '136',
        directPhone: '(203) 548 8021',
        email: 'pchiaia@impactservicegroup.com'
    },
    {
        name: 'Chalisa Langille',
        department: 'Vendor Management',
        title: 'Vendor Manager',
        extension: '150',
        directPhone: '(203) 902-8001',
        email: 'clangille@impactservicegroup.com'
    },
    {
        name: 'Eric Berkley',
        department: 'Vendor Management',
        title: 'SDR - Sales Development Representative',
        extension: '177',
        directPhone: '(203) 428-3953',
        email: 'eberkley@impactservicegroup.com'
    },
    {
        name: 'Kyle Morrison',
        department: 'Vendor Management',
        title: 'Vendor Manager',
        extension: '135',
        directPhone: '(203) 902-7337',
        email: 'kmorrison@impactservicegroup.com'
    },
    {
        name: 'Marico (Mai) Betonio',
        department: 'Vendor Management',
        title: 'Project Coordinator',
        extension: '807',
        directPhone: '(203) 431-8008',
        email: 'marico.betonio@impactservicegroup.com',
        isProjectCoordinator: true
    },
    {
        name: 'Rizyl (RI) Fernandez',
        department: 'Vendor Management',
        title: 'Project Coordinator',
        extension: '806',
        directPhone: '(203) 431-8008',
        email: 'rizyl.fernandez@impactservicegroup.com',
        isProjectCoordinator: true
    },

    // Finance Department
    {
        name: 'Pat Aldrich',
        department: 'Finance',
        title: 'Director of Finance',
        extension: '120',
        directPhone: '(203) 548 8007',
        email: 'paldrich@impactservicegroup.com'
    },
    {
        name: 'Stephanie Jalon',
        department: 'Finance',
        title: 'Administrative Assistant to Finance',
        extension: '140',
        directPhone: '(203) 431-8008',
        email: 'sjalon@impactservicegroup.com'
    },
    {
        name: 'Anthony Picchione',
        department: 'Finance',
        title: 'Senior AP/AR Repair Coordinator',
        extension: '145',
        directPhone: '(203) 902-7535',
        email: 'apicchione@impactservicegroup.com'
    },
    {
        name: 'Dorlene Madwid',
        department: 'Finance',
        title: 'AP/AR Repair Coordinator',
        extension: '126',
        directPhone: '(203) 431-8008',
        email: 'dmadwid@impactservicegroup.com'
    },
    {
        name: 'Elsy Cruz',
        department: 'Finance',
        title: 'AP/AR Repair Coordinator',
        extension: '141',
        directPhone: '(203) 431-8008',
        email: 'ecruz@impactservicegroup.com'
    },
    {
        name: 'Iris Trejos',
        department: 'Finance',
        title: 'AP/AR Repair Coordinator',
        extension: '134',
        directPhone: '(203) 902-7720',
        email: 'itrejos@impactservicegroup.com'
    },
    {
        name: 'Sean Enright',
        department: 'Finance',
        title: 'AP/AR Repair Coordinator',
        extension: '144',
        directPhone: '(203) 403-0229',
        email: 'senright@impactservicegroup.com'
    },

    // Preventive Maintenance Department
    {
        name: 'Janelle Baguio',
        department: 'Preventive Maintenance',
        title: 'Director of Operations',
        extension: '935',
        directPhone: '203-902-7447',
        email: 'jbaguio@impactservicegroup.com'
    },
    {
        name: 'Jackie Howlett',
        department: 'Preventive Maintenance',
        title: 'PM Program Manager',
        extension: '117',
        directPhone: '203-548-8024',
        email: 'jhowlett@impactservicegroup.com'
    },
    {
        name: 'Douglas Andersen',
        department: 'Preventive Maintenance',
        title: 'Vendor Coordinator',
        extension: '165',
        directPhone: '203-428-3958',
        email: 'dandersen@impactservicegroup.com'
    },
    {
        name: 'Gabriel Reges',
        department: 'Preventive Maintenance',
        title: 'Vendor Coordinator',
        extension: '171',
        directPhone: '203-428-3956',
        email: 'greges@impactservicegroup.com'
    },
    {
        name: 'Kathryn Corby',
        department: 'Preventive Maintenance',
        title: 'Vendor Coordinator',
        extension: '155',
        directPhone: '203-403-7947',
        email: 'kcorby@impactservicegroup.com'
    },
    {
        name: 'Kiarra Cacchillo',
        department: 'Preventive Maintenance',
        title: 'Vendor Coordinator',
        extension: '169',
        directPhone: '203-428-3954',
        email: 'kcacchillo@impactservicegroup.com'
    },
    {
        name: 'Rolen Altamirano',
        department: 'Preventive Maintenance',
        title: 'Vendor Coordinator',
        extension: '159',
        directPhone: '203-552-8884',
        email: 'raltamirano@impactservicegroup.com'
    },
    {
        name: 'Susi Petersen',
        department: 'Preventive Maintenance',
        title: 'Vendor Coordinator',
        extension: '131',
        directPhone: '203-902-7776',
        email: 'spetersen@impactservicegroup.com'
    },
    {
        name: 'Walter Linsley',
        department: 'Preventive Maintenance',
        title: 'Vendor Coordinator',
        extension: '166',
        directPhone: '203-428-3959',
        email: 'wlinsley@impactservicegroup.com'
    }
];

export const IMPACT_CLIENT_BRAND_MATRIX: ImpactBrandMapping[] = [
    { client: 'ADVANCE AUTO PARTS', keywords: ['ADVANCE AUTO PARTS', 'ADVANCE AUTO'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'AFFORDABLE DENTURES & IMPLANTS', keywords: ['AFFORDABLE DENTURES'], accountManagerName: 'Chris Rhone', projectCoordinatorName: 'Sinai Jordan' },
    { client: 'ALDO', keywords: ['ALDO'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'ALL BIRDS', keywords: ['ALL BIRDS', 'ALLBIRDS'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'LaToya Evans' },
    { client: 'ALL SAINTS', keywords: ['ALL SAINTS', 'ALLSAINTS'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'ALO YOGA', keywords: ['ALO YOGO', 'ALO YOGA'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'Richard Wetchler' },
    { client: 'AMAZON - ONE MEDICAL', keywords: ['AMAZON', 'ONE MEDICAL'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'BALENCIAGA', keywords: ['BALENCIAGA'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'BENEFIT COSMETICS', keywords: ['BENEFIT COSMETICS'], accountManagerName: 'Richard Wetchler', projectCoordinatorName: null },
    { client: 'BESTWAY RENTAL, INC', keywords: ['BESTWAY'], accountManagerName: 'Keith Sherling', projectCoordinatorName: null },
    { client: 'BLUELINX', keywords: ['BLUELINX'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'LaToya Evans' },
    { client: 'BOBS DISCOUNT FURNITURE', keywords: ['BOBS DISCOUNT FURNITURE', "BOB'S DISCOUNT FURNITURE"], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'BOOKS A MILLION', keywords: ['BOOKS A MILLION', 'BOOKS-A-MILLION', '2ND & CHARLES', 'YOGURT MOUNTAIN'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'BOTTEGA VENETA', keywords: ['BOTTEGEA VENETA', 'BOTTEGA VENETA'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'BRIGHTON COLLECTIBLES', keywords: ['BRIGHTON COLLECTIBLES', 'BRIGHTON'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'BUILD A BEAR', keywords: ['BUILD A BEAR', 'BUILD-A-BEAR'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'LaToya Evans' },
    { client: 'CASUAL MALE RETAIL GROUP', keywords: ['CASUAL MALE', 'DXL', 'BIG & TALL'], accountManagerName: 'Brendan Mahan', projectCoordinatorName: null },
    { client: 'CELLULAR SALES MANAGEMENT GROUP (VERIZON)', keywords: ['CELLULAR SALES', 'VERIZON'], accountManagerName: 'Chris Rhone', projectCoordinatorName: 'Sinai Jordan' },
    { client: 'CHANEL', keywords: ['CHANEL'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'CHILD DEVELOPMENT SCHOOLS', keywords: ['CHILD DEVELOPMENT SCHOOLS'], accountManagerName: 'Chris Rhone', projectCoordinatorName: 'Sinai Jordan' },
    { client: 'CLAIRES BOUTIQUE', keywords: ['CLAIRES', "CLAIRE'S"], accountManagerName: 'LaToya Evans', projectCoordinatorName: 'Scott McPherson' },
    { client: 'COLE HAAN', keywords: ['COLE HAAN'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'CRASH CHAMPIONS', keywords: ['CRASH CHAMPIONS'], accountManagerName: 'Keith Sherling', projectCoordinatorName: null },
    { client: 'CROWN CASTLE', keywords: ['CROWN CASTLE'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'DAINESE', keywords: ['DAINESE'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'LaToya Evans' },
    { client: 'DAL-TILE CORPORATION', keywords: ['DAL-TILE', 'DAL TILE', 'SAND & STONE', 'MARAZZI TILE'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Mary Anthony' },
    { client: 'DAVID YURMAN', keywords: ['DAVID YURMAN'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'DTLR', keywords: ['DTLR'], accountManagerName: null, projectCoordinatorName: null },
    { client: 'ECCO RETAIL, LLC', keywords: ['ECCO RETAIL', 'ECCO'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'EDWARD JONES INVESTMENTS', keywords: ['EDWARD JONES'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'EXTRA SPACE STORAGE', keywords: ['EXTRA SPACE STORAGE'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'FABLETICS', keywords: ['FABLETICS'], accountManagerName: 'Chris Rhone', projectCoordinatorName: 'Sinai Jordan' },
    { client: 'FENDI', keywords: ['FENDI'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'FINISH LINE / JD SPORTS', keywords: ['FINISH LINE', 'JD SPORTS', 'RUNNING COMPANY', 'RUN ON', 'BLUE MILE'], accountManagerName: 'Joe Greenfield', projectCoordinatorName: 'Caroline Bernstein' },
    { client: 'FLOYDS 99', keywords: ['FLOYDS 99', "FLOYD'S 99"], accountManagerName: null, projectCoordinatorName: null },
    { client: 'GENESCO', keywords: ['GENESCO', 'JOURNEYS', 'JOHNSTON & MURPHY', 'SHI', 'UNDERGROUND STATION', 'UNDERGROUND BY JOURNEYS', 'JOURNEYS KIDZ', 'JARMEN'], accountManagerName: 'Sharon Peck', projectCoordinatorName: 'Mathew Flavin' },
    { client: 'GIORGIO ARMANI', keywords: ['GIORGIO ARMANI', 'ARMANI'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'GIVENCHY', keywords: ['GIVENCHY'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'GUCCI', keywords: ['GUCCI'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'GUESS', keywords: ['GUESS'], accountManagerName: 'Makeba Freeman', projectCoordinatorName: 'Giacomo Micciari' },
    { client: 'GXO LOGISTICS', keywords: ['GXO LOGISTICS', 'GXO'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'H & R BLOCK', keywords: ['H & R BLOCK', 'H&R BLOCK'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'HEARTLAND DENTAL', keywords: ['HEARTLAND DENTAL'], accountManagerName: 'Sharon Peck', projectCoordinatorName: 'Mathew Flavin' },
    { client: 'HOT TOPIC / BOX LUNCH', keywords: ['HOT TOPIC', 'BOX LUNCH'], accountManagerName: 'Chris Rhone', projectCoordinatorName: 'Sinai Jordan' },
    { client: 'INNOVATIVE RENAL CARE', keywords: ['INNOVATIVE RENAL CARE'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'J.JILL', keywords: ['J.JILL', 'J. JILL', 'J JILL'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'JACKSON HEWITT', keywords: ['JACKSON HEWITT'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'LaToya Evans' },
    { client: 'JOCKEY', keywords: ['JOCKEY'], accountManagerName: null, projectCoordinatorName: null },
    { client: 'KIRKLANDS', keywords: ['KIRKLANDS', "KIRKLAND'S"], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: "L'OCCITANE EN PROVENCE", keywords: ["L'OCCITANE", 'LOCCITANE'], accountManagerName: 'Joe Greenfield', projectCoordinatorName: 'Caroline Bernstein' },
    { client: 'LIDS FANZZ', keywords: ['LIDS', 'FANZZ', 'LOCKER ROOM BY LIDS'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'LaToya Evans' },
    { client: 'MANPOWER', keywords: ['MANPOWER'], accountManagerName: 'Brendan Mahan', projectCoordinatorName: null },
    { client: 'NATIONAL VISION', keywords: ['NATIONAL VISION', 'AMERICAS BEST', "AMERICA'S BEST", 'EYEGLASS WORLD'], accountManagerName: 'Makeba Freeman', projectCoordinatorName: 'Giacomo Micciari' },
    { client: 'OCEAN STATE JOB LOT', keywords: ['OCEAN STATE JOB LOT'], accountManagerName: 'Dominick Cavoto', projectCoordinatorName: 'LaToya Evans' },
    { client: 'PAINTED TREE BOUTIQUE', keywords: ['PAINTED TREE'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'POP MART', keywords: ['POP MART'], accountManagerName: null, projectCoordinatorName: null },
    { client: 'PPG - PITTSBURGH PAINT GROUP', keywords: ['PPG', 'PITTSBURGH PAINT'], accountManagerName: 'Sharon Peck', projectCoordinatorName: 'Mathew Flavin' },
    { client: 'PRADA', keywords: ['PRADA'], accountManagerName: null, projectCoordinatorName: null },
    { client: 'PVH CORP. (Calvin Klein, Tommy Hilfiger)', keywords: ['PVH', 'CALVIN KLEIN', 'TOMMY HILFIGER'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'RALPH LAUREN', keywords: ['RALPH LAUREN'], accountManagerName: 'Keith Sherling', projectCoordinatorName: null },
    { client: 'REAL TERM', keywords: ['REAL TERM'], accountManagerName: 'Scott McPherson', projectCoordinatorName: 'Scott McPherson' },
    { client: 'ROBERT GRAHAM (Centric Brands)', keywords: ['ROBERT GRAHAM', 'CENTRIC BRANDS'], accountManagerName: 'Makeba Freeman', projectCoordinatorName: 'Giacomo Micciari' },
    { client: 'SEPHORA', keywords: ['SEPHORA'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'SKECHERS USA', keywords: ['SKECHERS'], accountManagerName: 'Douglas Peet', projectCoordinatorName: 'Joe Greenfield' },
    { client: 'SMALL DOOR VETERINARY', keywords: ['SMALL DOOR VETERINARY', 'SMALL DOOR'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'SOUTH MOON UNDER', keywords: ['SOUTH MOON UNDER'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Samantha Wolf' },
    { client: 'SPENCER GIFTS', keywords: ['SPENCER GIFTS', "SPENCER'S", 'SPENCERS'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'STEVE MADDEN', keywords: ['STEVE MADDEN'], accountManagerName: 'Brendan Mahan', projectCoordinatorName: null },
    { client: 'SUIT SUPPLY', keywords: ['SUIT SUPPLY', 'SUITSUPPLY'], accountManagerName: 'Keith Sherling', projectCoordinatorName: 'Jevon Pintard' },
    { client: 'SUNNYSIDE MEDICAL DISPENSARY', keywords: ['SUNNYSIDE'], accountManagerName: 'Scott McPherson', projectCoordinatorName: 'Scott McPherson' },
    { client: 'SWAROVSKI', keywords: ['SWAROVSKI'], accountManagerName: 'Makeba Freeman', projectCoordinatorName: 'Giacomo Micciari' },
    { client: 'TAPESTRY (Coach)', keywords: ['TAPESTRY', 'COACH'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'TECOVAS, INC.', keywords: ['TECOVAS'], accountManagerName: null, projectCoordinatorName: null },
    { client: 'TIFFANY', keywords: ['TIFFANY'], accountManagerName: 'Chris Rhone', projectCoordinatorName: 'Sinai Jordan' },
    { client: 'TORRID', keywords: ['TORRID'], accountManagerName: 'Chris Rhone', projectCoordinatorName: 'Sinai Jordan' },
    { client: 'TUMI', keywords: ['TUMI'], accountManagerName: 'Elisa Overlock', projectCoordinatorName: 'Douglas Peet' },
    { client: 'VINEYARD VINES', keywords: ['VINEYARD VINES'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' },
    { client: 'WARBY PARKER', keywords: ['WARBY PARKER'], accountManagerName: 'Brendan Corris', projectCoordinatorName: 'Mary Anthony' }
];

/**
 * Find personnel info by name (case-insensitive fuzzy match)
 */
export function findImpactPersonnel(name?: string | null): ImpactPersonnel | null {
    if (!name) return null;
    const clean = name.trim().toLowerCase();
    
    // Direct or contains match
    const found = IMPACT_PERSONNEL_DIRECTORY.find(p => {
        const pName = p.name.toLowerCase();
        return pName === clean || pName.includes(clean) || clean.includes(pName);
    });
    
    if (found) return found;

    // First name match fallback for specific unambiguous staff
    if (clean === 'dom' || clean === 'dominick') {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'Dominick Cavoto') || null;
    }
    if (clean === 'elisa') {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'Elisa Overlock') || null;
    }
    if (clean === 'latoya') {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'LaToya Evans') || null;
    }
    if (clean === 'mary') {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'Mary Anthony') || null;
    }
    if (clean === 'rich') {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'Richard Wetchler') || null;
    }
    if (clean === 'doug' || clean === 'doug peet') {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'Douglas Peet') || null;
    }
    if (clean.includes('sinai')) {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'Sinai Jordan') || null;
    }
    if (clean.includes('flavin')) {
        return IMPACT_PERSONNEL_DIRECTORY.find(p => p.name === 'Mathew Flavin') || null;
    }

    return null;
}

/**
 * Resolve Account Manager & Project Coordinator given a location name or store identifier
 */
export function resolveImpactContactsForLocation(locationName: string, storeNumber?: string | null): {
    matchedBrand: string | null;
    accountManager: ImpactPersonnel | null;
    projectCoordinator: ImpactPersonnel | null;
} {
    const text = `${locationName || ''} ${storeNumber || ''}`.toUpperCase();

    const matchedEntry = IMPACT_CLIENT_BRAND_MATRIX.find(m => 
        m.keywords.some(kw => text.includes(kw.toUpperCase()))
    );

    if (!matchedEntry) {
        return { matchedBrand: null, accountManager: null, projectCoordinator: null };
    }

    const accountManager = findImpactPersonnel(matchedEntry.accountManagerName);
    const projectCoordinator = findImpactPersonnel(matchedEntry.projectCoordinatorName);

    return {
        matchedBrand: matchedEntry.client,
        accountManager,
        projectCoordinator
    };
}

/**
 * Standard Marico (Mai) Betonio profile - Vendor Management Project Coordinator
 */
export const IMPACT_MARICO_BETONIO: ImpactPersonnel = {
    name: 'Marico (Mai) Betonio',
    department: 'Vendor Management',
    title: 'Project Coordinator',
    extension: '807',
    directPhone: '(203) 431-8008',
    email: 'marico.betonio@impactservicegroup.com',
    isProjectCoordinator: true
};

/**
 * Detect whether a customer or identifier belongs to Impact Service Group
 */
export function isImpactCustomer(
    customer?: { id?: string; name?: string; email?: string } | null, 
    customerName?: string | null
): boolean {
    const cid = (customer?.id || '').trim();
    const cname = (customer?.name || customerName || '').trim().toLowerCase();
    const cemail = (customer?.email || '').trim().toLowerCase();
    return cid === 'cust-1787187506048' || 
           cid === 'cust-1788453962303' || 
           cname.includes('impact') || 
           cemail.includes('impactservicegroup.com');
}

/**
 * Resolve the standard default recipients for an Impact document:
 * - Store POCs (Account Manager, Project Coordinator for the store)
 * - Marico (Mai) Betonio (always included on all Impact documents)
 * - Invoicing email (always included on all invoices)
 */
export function getImpactDefaultRecipients(params: {
    locationName?: string | null;
    storeNumber?: string | null;
    serviceLocation?: any;
    customer?: any;
    job?: any;
    proposal?: any;
    isInvoice?: boolean;
}): {
    storeContacts: Array<{ name: string; email: string; role: string }>;
    defaultEmails: string[];
    maricoEmail: string;
    invoicingEmail: string;
} {
    const storeContacts: Array<{ name: string; email: string; role: string }> = [];
    const defaultEmails: string[] = [];

    const locName = params.serviceLocation?.name || params.locationName || params.job?.locationName || params.proposal?.locationName || params.job?.address || '';
    const storeNum = params.serviceLocation?.storeNumber || params.storeNumber || params.job?.storeNumber;

    // 1. From job/proposal direct contact objects if present
    const amContact = params.job?.accountManagerContact || params.proposal?.accountManagerContact || params.serviceLocation?.accountManager;
    if (amContact?.email && amContact?.name) {
        storeContacts.push({
            name: amContact.name,
            email: amContact.email.toLowerCase(),
            role: 'Account Manager'
        });
    }

    const pcContact = params.job?.pocContact || params.proposal?.pocContact;
    if (pcContact?.email && pcContact?.name) {
        if (!storeContacts.some(c => c.email === pcContact.email.toLowerCase())) {
            storeContacts.push({
                name: pcContact.name,
                email: pcContact.email.toLowerCase(),
                role: 'Project Coordinator'
            });
        }
    }

    // 2. From serviceLocation.contacts
    if (Array.isArray(params.serviceLocation?.contacts)) {
        params.serviceLocation.contacts.forEach((c: any) => {
            if (c.email && c.name && !storeContacts.some(existing => existing.email === c.email.toLowerCase())) {
                storeContacts.push({
                    name: c.name,
                    email: c.email.toLowerCase(),
                    role: c.role || c.title || 'Site POC'
                });
            }
        });
    }

    // 3. Fallback resolution via matrix
    if (storeContacts.length === 0 && (locName || storeNum)) {
        const resolved = resolveImpactContactsForLocation(locName, storeNum);
        if (resolved.accountManager?.email) {
            storeContacts.push({
                name: resolved.accountManager.name,
                email: resolved.accountManager.email.toLowerCase(),
                role: `Account Manager${resolved.matchedBrand ? ` (${resolved.matchedBrand})` : ''}`
            });
        }
        if (resolved.projectCoordinator?.email) {
            storeContacts.push({
                name: resolved.projectCoordinator.name,
                email: resolved.projectCoordinator.email.toLowerCase(),
                role: `Project Coordinator${resolved.matchedBrand ? ` (${resolved.matchedBrand})` : ''}`
            });
        }
    }

    // Default select store contacts
    storeContacts.forEach(c => {
        if (!defaultEmails.includes(c.email)) {
            defaultEmails.push(c.email);
        }
    });

    // Always include Marico
    const maricoEmail = IMPACT_MARICO_BETONIO.email.toLowerCase();
    if (!defaultEmails.includes(maricoEmail)) {
        defaultEmails.push(maricoEmail);
    }

    // Always include invoicing email on invoices
    const invoicingEmail = IMPACT_GENERAL_INFO.invoicingEmail.toLowerCase();
    if (params.isInvoice && !defaultEmails.includes(invoicingEmail)) {
        defaultEmails.push(invoicingEmail);
    }

    return {
        storeContacts,
        defaultEmails,
        maricoEmail,
        invoicingEmail
    };
}
