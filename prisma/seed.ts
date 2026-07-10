/**
 * Demo/dev seed data for Kinsen Used Cars.
 *
 * Run with `npx prisma db seed` (already wired up via the `prisma.seed`
 * entry in package.json, which runs this file through `tsx`).
 *
 * Idempotent: re-running this script will not duplicate the admin user,
 * vehicles (matched by `externalCarId`), or FAQ items (skipped if any
 * already exist). Site settings are always upserted by key.
 *
 * IMPORTANT: this is demo content only. Nothing in this file is imported
 * or referenced by application code outside of this script.
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/server/services/auth.service";
import { generateUniqueVehicleSlug } from "@/lib/slug";
import { updateSiteSetting } from "@/server/services/settings.service";
import { FALLBACK_VEHICLE_IMAGE } from "@/lib/images";

const ADMIN_EMAIL = "admin@kinsen.local";
const ADMIN_PASSWORD = "change-me-after-login";

interface SeedVehicle {
  externalCarId: string;
  maker: string;
  model: string;
  yearRelease: number;
  price: number;
  monthlyPrice: number;
  km: number;
  cc: number | null;
  hp: number;
  fuel: string;
  transmissionType: string;
  color: string;
  typeOfCar: string;
  offer: boolean;
  froze: boolean;
  description: string;
  features: string[];
}

const SEED_VEHICLES: SeedVehicle[] = [
  {
    externalCarId: "SEED-001",
    maker: "Toyota",
    model: "Corolla",
    yearRelease: 2021,
    price: 17900,
    monthlyPrice: 259,
    km: 42000,
    cc: 1800,
    hp: 122,
    fuel: "Hybrid",
    transmissionType: "Αυτόματο",
    color: "Λευκό",
    typeOfCar: "Sedan",
    offer: true,
    froze: false,
    description: "Οικονομικό υβριδικό sedan σε άριστη κατάσταση, ιδανικό για leasing.",
    features: ["Κλιματισμός", "Bluetooth", "Αισθητήρες παρκαρίσματος", "Cruise control"],
  },
  {
    externalCarId: "SEED-002",
    maker: "Volkswagen",
    model: "Golf",
    yearRelease: 2020,
    price: 15900,
    monthlyPrice: 229,
    km: 61000,
    cc: 1600,
    hp: 116,
    fuel: "Πετρέλαιο",
    transmissionType: "Χειροκίνητο",
    color: "Γκρι",
    typeOfCar: "Hatchback",
    offer: false,
    froze: false,
    description: "Το κλασικό hatchback της VW με χαμηλή κατανάλωση και άριστο service ιστορικό.",
    features: ["Κλιματισμός", "Bluetooth", "Ζάντες αλουμινίου"],
  },
  {
    externalCarId: "SEED-003",
    maker: "Mercedes-Benz",
    model: "A-Class",
    yearRelease: 2022,
    price: 26900,
    monthlyPrice: 389,
    km: 28000,
    cc: 1332,
    hp: 136,
    fuel: "Βενζίνη",
    transmissionType: "Αυτόματο",
    color: "Μαύρο",
    typeOfCar: "Hatchback",
    offer: true,
    froze: false,
    description: "Premium compact hatchback με πλήρη εξοπλισμό ασφαλείας και MBUX σύστημα.",
    features: ["MBUX Infotainment", "Δερμάτινο τιμόνι", "Κάμερα οπισθοπορείας", "LED φωτισμός"],
  },
  {
    externalCarId: "SEED-004",
    maker: "Hyundai",
    model: "i20",
    yearRelease: 2021,
    price: 13500,
    monthlyPrice: 199,
    km: 35000,
    cc: 1200,
    hp: 84,
    fuel: "Βενζίνη",
    transmissionType: "Χειροκίνητο",
    color: "Κόκκινο",
    typeOfCar: "Πόλης",
    offer: false,
    froze: false,
    description: "Ευέλικτο αυτοκίνητο πόλης με χαμηλά χιλιόμετρα, ιδανικό για καθημερινή χρήση.",
    features: ["Κλιματισμός", "Bluetooth", "Ηλεκτρικά παράθυρα"],
  },
  {
    externalCarId: "SEED-005",
    maker: "Skoda",
    model: "Octavia",
    yearRelease: 2020,
    price: 16900,
    monthlyPrice: 245,
    km: 72000,
    cc: 2000,
    hp: 150,
    fuel: "Πετρέλαιο",
    transmissionType: "Αυτόματο",
    color: "Μπλε",
    typeOfCar: "Sedan",
    offer: false,
    froze: false,
    description: "Ευρύχωρο sedan με μεγάλο πορτ μπαγκάζ, εξαιρετική επιλογή για οικογένειες.",
    features: ["Κλιματισμός δύο ζωνών", "Cruise control", "Αισθητήρες παρκαρίσματος"],
  },
  {
    externalCarId: "SEED-006",
    maker: "Renault",
    model: "Clio",
    yearRelease: 2022,
    price: 14200,
    monthlyPrice: 209,
    km: 21000,
    cc: 1000,
    hp: 100,
    fuel: "Βενζίνη",
    transmissionType: "Χειροκίνητο",
    color: "Κίτρινο",
    typeOfCar: "Πόλης",
    offer: true,
    froze: false,
    description: "Σχεδόν καινούργιο, οικονομικό στην κατανάλωση με μοντέρνο σχεδιασμό.",
    features: ["Οθόνη αφής", "Bluetooth", "Android Auto / Apple CarPlay"],
  },
  {
    externalCarId: "SEED-007",
    maker: "Peugeot",
    model: "3008",
    yearRelease: 2021,
    price: 24500,
    monthlyPrice: 349,
    km: 45000,
    cc: 1500,
    hp: 130,
    fuel: "Πετρέλαιο",
    transmissionType: "Αυτόματο",
    color: "Γκρι",
    typeOfCar: "SUV",
    offer: false,
    froze: false,
    description: "Στιλάτο SUV με i-Cockpit και άνετη καμπίνα για μεγάλες διαδρομές.",
    features: ["i-Cockpit", "Κάμερα 360°", "Ζάντες αλουμινίου 18\""],
  },
  {
    externalCarId: "SEED-008",
    maker: "Ford",
    model: "Focus",
    yearRelease: 2019,
    price: 12900,
    monthlyPrice: 189,
    km: 85000,
    cc: 1500,
    hp: 120,
    fuel: "Πετρέλαιο",
    transmissionType: "Χειροκίνητο",
    color: "Λευκό",
    typeOfCar: "Hatchback",
    offer: false,
    froze: false,
    description: "Αξιόπιστο hatchback με ζωντανή οδηγική συμπεριφορά.",
    features: ["Κλιματισμός", "Bluetooth"],
  },
  {
    externalCarId: "SEED-009",
    maker: "Opel",
    model: "Corsa",
    yearRelease: 2022,
    price: 13900,
    monthlyPrice: 205,
    km: 18000,
    cc: 1200,
    hp: 100,
    fuel: "Βενζίνη",
    transmissionType: "Χειροκίνητο",
    color: "Πορτοκαλί",
    typeOfCar: "Πόλης",
    offer: true,
    froze: false,
    description: "Νεανικό αυτοκίνητο πόλης με ελάχιστα χιλιόμετρα και εγγύηση εργοστασίου.",
    features: ["Οθόνη αφής 7\"", "Κλιματισμός", "Αισθητήρες παρκαρίσματος"],
  },
  {
    externalCarId: "SEED-010",
    maker: "Nissan",
    model: "Qashqai",
    yearRelease: 2021,
    price: 22900,
    monthlyPrice: 329,
    km: 39000,
    cc: 1300,
    hp: 140,
    fuel: "Βενζίνη",
    transmissionType: "Αυτόματο",
    color: "Μπλε",
    typeOfCar: "SUV",
    offer: false,
    froze: false,
    description: "Best-seller SUV με άνεση, ασφάλεια και χαμηλό κόστος συντήρησης.",
    features: ["ProPILOT", "Κάμερα οπισθοπορείας", "Κλιματισμός αυτόματος"],
  },
  {
    externalCarId: "SEED-011",
    maker: "Kia",
    model: "Ceed",
    yearRelease: 2020,
    price: 14900,
    monthlyPrice: 219,
    km: 58000,
    cc: 1400,
    hp: 100,
    fuel: "Βενζίνη",
    transmissionType: "Χειροκίνητο",
    color: "Ασημί",
    typeOfCar: "Hatchback",
    offer: false,
    froze: false,
    description: "Πρακτικό hatchback με 7ετή εγγύηση εργοστασίου ακόμα σε ισχύ.",
    features: ["Κλιματισμός", "Bluetooth", "Ζάντες αλουμινίου"],
  },
  {
    externalCarId: "SEED-012",
    maker: "Citroën",
    model: "C3",
    yearRelease: 2021,
    price: 13200,
    monthlyPrice: 195,
    km: 33000,
    cc: 1200,
    hp: 83,
    fuel: "Βενζίνη",
    transmissionType: "Χειροκίνητο",
    color: "Κόκκινο",
    typeOfCar: "Πόλης",
    offer: false,
    froze: false,
    description: "Στιλάτο μικρό αυτοκίνητο με χαρακτηριστικό σχεδιασμό και άνετη ανάρτηση.",
    features: ["Airbags Advanced Comfort", "Κλιματισμός", "Bluetooth"],
  },
  {
    externalCarId: "SEED-013",
    maker: "Fiat",
    model: "500",
    yearRelease: 2022,
    price: 15900,
    monthlyPrice: 235,
    km: 15000,
    cc: 1000,
    hp: 70,
    fuel: "Hybrid",
    transmissionType: "Χειροκίνητο",
    color: "Πράσινο",
    typeOfCar: "Πόλης",
    offer: true,
    froze: false,
    description: "Ίκονικο design με ελάχιστη κατανάλωση χάρη στο mild-hybrid σύστημα.",
    features: ["Οθόνη αφής", "Ηλεκτρικά παράθυρα", "Bluetooth"],
  },
  {
    externalCarId: "SEED-014",
    maker: "Seat",
    model: "Leon",
    yearRelease: 2020,
    price: 16500,
    monthlyPrice: 240,
    km: 64000,
    cc: 1500,
    hp: 130,
    fuel: "Βενζίνη",
    transmissionType: "Αυτόματο",
    color: "Μαύρο",
    typeOfCar: "Hatchback",
    offer: false,
    froze: false,
    description: "Σπορτίφ εμφάνιση με δυναμική οδηγική αίσθηση και πλούσιο εξοπλισμό.",
    features: ["Digital Cockpit", "Κλιματισμός δύο ζωνών", "Full LED"],
  },
  {
    externalCarId: "SEED-015",
    maker: "Mazda",
    model: "CX-5",
    yearRelease: 2021,
    price: 25900,
    monthlyPrice: 369,
    km: 41000,
    cc: 2000,
    hp: 165,
    fuel: "Βενζίνη",
    transmissionType: "Αυτόματο",
    color: "Κόκκινο",
    typeOfCar: "SUV",
    offer: false,
    froze: true,
    description: "Premium SUV με εξαιρετική ποιότητα κατασκευής — προσωρινά μη διαθέσιμο.",
    features: ["Bose Sound System", "Δερμάτινα καθίσματα", "Head-up display"],
  },
  {
    externalCarId: "SEED-016",
    maker: "Honda",
    model: "Civic",
    yearRelease: 2019,
    price: 14500,
    monthlyPrice: 215,
    km: 78000,
    cc: 1600,
    hp: 125,
    fuel: "Πετρέλαιο",
    transmissionType: "Χειροκίνητο",
    color: "Γκρι",
    typeOfCar: "Hatchback",
    offer: false,
    froze: false,
    description: "Θρυλική αξιοπιστία Honda με πολύ καλή διατήρηση αξίας.",
    features: ["Κλιματισμός", "Bluetooth", "Cruise control"],
  },
  {
    externalCarId: "SEED-017",
    maker: "BMW",
    model: "118i",
    yearRelease: 2022,
    price: 27900,
    monthlyPrice: 399,
    km: 24000,
    cc: 1500,
    hp: 140,
    fuel: "Βενζίνη",
    transmissionType: "Αυτόματο",
    color: "Λευκό",
    typeOfCar: "Hatchback",
    offer: true,
    froze: false,
    description: "Premium hatchback με δυναμική οδήγηση και εξοπλισμό M Sport.",
    features: ["M Sport πακέτο", "iDrive 7", "Ζάντες αλουμινίου 17\""],
  },
  {
    externalCarId: "SEED-018",
    maker: "Audi",
    model: "A3",
    yearRelease: 2020,
    price: 23900,
    monthlyPrice: 339,
    km: 52000,
    cc: 1400,
    hp: 150,
    fuel: "Βενζίνη",
    transmissionType: "Αυτόματο",
    color: "Μπλε",
    typeOfCar: "Hatchback",
    offer: false,
    froze: false,
    description: "Κομψό premium hatchback με ψηφιακό ταμπλό Virtual Cockpit.",
    features: ["Virtual Cockpit", "Κλιματισμός τριών ζωνών", "Adaptive cruise control"],
  },
  {
    externalCarId: "SEED-019",
    maker: "Volvo",
    model: "XC40",
    yearRelease: 2023,
    price: 34900,
    monthlyPrice: 469,
    km: 12000,
    cc: null,
    hp: 231,
    fuel: "Electric",
    transmissionType: "Αυτόματο",
    color: "Ασημί",
    typeOfCar: "SUV",
    offer: true,
    froze: false,
    description: "100% ηλεκτρικό SUV με μεγάλη αυτονομία, ιδανικό για τα επόμενα χρόνια leasing.",
    features: ["Πλήρως ηλεκτρικό", "Google built-in", "Θερμαινόμενα καθίσματα"],
  },
  {
    externalCarId: "SEED-020",
    maker: "Dacia",
    model: "Duster",
    yearRelease: 2021,
    price: 16900,
    monthlyPrice: 249,
    km: 46000,
    cc: 1500,
    hp: 115,
    fuel: "Πετρέλαιο",
    transmissionType: "Χειροκίνητο",
    color: "Καφέ",
    typeOfCar: "SUV",
    offer: false,
    froze: true,
    description: "Ανθεκτικό και οικονομικό SUV — προσωρινά παγωμένο εν αναμονή service.",
    features: ["4x2", "Κλιματισμός", "Αισθητήρες παρκαρίσματος"],
  },
];

const FAQ_ITEMS: Array<{ category: string; question: string; answer: string }> = [
  // Leasing μεταχειρισμένου
  {
    category: "Leasing μεταχειρισμένου",
    question: "Τι είναι το leasing μεταχειρισμένου αυτοκινήτου;",
    answer:
      "Το leasing μεταχειρισμένου σας επιτρέπει να χρησιμοποιείτε ένα ελεγμένο, μεταχειρισμένο αυτοκίνητο έναντι σταθερής μηνιαίας δόσης, χωρίς να χρειάζεται να το αγοράσετε εξ ολοκλήρου. Η Kinsen αναλαμβάνει τη συντήρηση και την ασφάλιση, σύμφωνα με το πρόγραμμα που θα επιλέξετε.",
  },
  {
    category: "Leasing μεταχειρισμένου",
    question: "Ποια είναι η ελάχιστη διάρκεια σύμβασης leasing;",
    answer:
      "Οι συμβάσεις leasing ξεκινούν συνήθως από 12 μήνες και μπορούν να επεκταθούν έως και 48 μήνες, ανάλογα με το όχημα και τις ανάγκες σας.",
  },
  {
    category: "Leasing μεταχειρισμένου",
    question: "Μπορώ να αγοράσω το αυτοκίνητο στο τέλος της σύμβασης;",
    answer:
      "Ναι, στο τέλος της περιόδου leasing έχετε τη δυνατότητα εξαγοράς του οχήματος στην υπολειπόμενη αξία που αναγράφεται στη σύμβαση, ή να το επιστρέψετε και να προχωρήσετε σε νέο leasing.",
  },
  {
    category: "Leasing μεταχειρισμένου",
    question: "Υπάρχει όριο χιλιομέτρων στο leasing;",
    answer:
      "Κάθε σύμβαση περιλαμβάνει ένα συμφωνημένο ετήσιο όριο χιλιομέτρων. Σε περίπτωση υπέρβασης, ισχύει μικρή χρέωση ανά επιπλέον χιλιόμετρο, η οποία αναφέρεται ρητά στη σύμβαση.",
  },
  // Δανειοδότηση
  {
    category: "Δανειοδότηση",
    question: "Προσφέρετε λύσεις χρηματοδότησης εκτός leasing;",
    answer:
      "Ναι, συνεργαζόμαστε με τράπεζες και εταιρείες χρηματοδότησης για να σας προσφέρουμε δανειακά προγράμματα αγοράς αυτοκινήτου με ανταγωνιστικά επιτόκια.",
  },
  {
    category: "Δανειοδότηση",
    question: "Ποια δικαιολογητικά χρειάζονται για έγκριση δανείου;",
    answer:
      "Συνήθως απαιτούνται ταυτότητα, αποδεικτικό εισοδήματος (εκκαθαριστικό ή μισθοδοσία) και αποδεικτικό διαμονής. Η ομάδα μας θα σας καθοδηγήσει βήμα-βήμα.",
  },
  {
    category: "Δανειοδότηση",
    question: "Πόσο χρόνο διαρκεί η έγκριση χρηματοδότησης;",
    answer:
      "Η προέγκριση συνήθως ολοκληρώνεται εντός 24-48 ωρών από την υποβολή πλήρων δικαιολογητικών.",
  },
  // Εγγύηση
  {
    category: "Εγγύηση",
    question: "Τα μεταχειρισμένα αυτοκίνητα καλύπτονται από εγγύηση;",
    answer:
      "Όλα τα οχήματα της Kinsen περνούν από πλήρη μηχανικό έλεγχο και συνοδεύονται από εγγύηση καλής λειτουργίας κινητήρα και κιβωτίου ταχυτήτων, διάρκειας τουλάχιστον 6 μηνών.",
  },
  {
    category: "Εγγύηση",
    question: "Τι καλύπτει η εγγύηση της Kinsen;",
    answer:
      "Καλύπτει βλάβες κινητήρα, κιβωτίου ταχυτήτων και βασικών ηλεκτρονικών συστημάτων, εξαιρουμένης της φυσιολογικής φθοράς αναλωσίμων (λάστιχα, τακάκια, μπαταρία κ.λπ.).",
  },
  {
    category: "Εγγύηση",
    question: "Ισχύει ακόμα η εργοστασιακή εγγύηση σε νεότερα μοντέλα;",
    answer:
      "Σε αρκετά από τα νεότερα οχήματά μας ισχύει ακόμα μέρος της εργοστασιακής εγγύησης του κατασκευαστή, κάτι που αναφέρεται ρητά στη σελίδα κάθε αγγελίας.",
  },
  // Διαδικασία αγοράς/παράδοσης
  {
    category: "Διαδικασία αγοράς/παράδοσης",
    question: "Πώς γίνεται η διαδικασία αγοράς βήμα-βήμα;",
    answer:
      "Επιλέγετε όχημα, κλείνετε δοκιμαστική οδήγηση, συμφωνούμε στους όρους (αγορά, leasing ή δανειοδότηση), ολοκληρώνουμε τα έγγραφα και προγραμματίζουμε την παράδοση.",
  },
  {
    category: "Διαδικασία αγοράς/παράδοσης",
    question: "Μπορώ να κάνω δοκιμαστική οδήγηση πριν αποφασίσω;",
    answer:
      "Φυσικά. Κάθε ενδιαφερόμενος μπορεί να κλείσει δωρεάν δοκιμαστική οδήγηση μέσω της φόρμας ενδιαφέροντος στη σελίδα του οχήματος.",
  },
  {
    category: "Διαδικασία αγοράς/παράδοσης",
    question: "Πόσο χρόνο παίρνει η παράδοση του αυτοκινήτου;",
    answer:
      "Συνήθως η παράδοση πραγματοποιείται εντός 3-7 εργάσιμων ημερών από την υπογραφή της σύμβασης, εφόσον έχουν ολοκληρωθεί τα δικαιολογητικά.",
  },
  // Έγγραφα
  {
    category: "Έγγραφα",
    question: "Ποια έγγραφα παραλαμβάνω με το αυτοκίνητο;",
    answer:
      "Παραλαμβάνετε άδεια κυκλοφορίας, βιβλιάριο συντήρησης, δελτίο τεχνικού ελέγχου (ΚΤΕΟ) εν ισχύ, καθώς και το τιμολόγιο ή τη σύμβαση leasing/χρηματοδότησης.",
  },
  {
    category: "Έγγραφα",
    question: "Χρειάζεται μεταβίβαση στο όνομά μου σε περίπτωση αγοράς;",
    answer:
      "Ναι, σε περίπτωση οριστικής αγοράς η μεταβίβαση γίνεται στο όνομά σας μέσω της αρμόδιας Δ.Ο.Υ./υπηρεσίας μεταφορών, και η ομάδα μας σας καθοδηγεί σε όλα τα βήματα.",
  },
  {
    category: "Έγγραφα",
    question: "Στο leasing, σε ποιου το όνομα είναι το αυτοκίνητο;",
    answer:
      "Στο leasing η κυριότητα του οχήματος παραμένει στην Kinsen για όλη τη διάρκεια της σύμβασης, ενώ εσείς έχετε πλήρη δικαίωμα χρήσης.",
  },
  // Πληρωμές
  {
    category: "Πληρωμές",
    question: "Ποιοι τρόποι πληρωμής είναι διαθέσιμοι;",
    answer:
      "Δεχόμαστε τραπεζική κατάθεση/μεταφορά, πάγια εντολή για τις μηνιαίες δόσεις leasing, καθώς και πληρωμή μέσω συνεργαζόμενης τράπεζας για δανειοδότηση.",
  },
  {
    category: "Πληρωμές",
    question: "Τι γίνεται αν καθυστερήσω μια δόση leasing;",
    answer:
      "Επικοινωνήστε άμεσα με την ομάδα μας σε περίπτωση δυσκολίας πληρωμής — εξετάζουμε κάθε περίπτωση ξεχωριστά ώστε να βρούμε μια βιώσιμη λύση πριν επιβληθούν τυχόν χρεώσεις.",
  },
  {
    category: "Πληρωμές",
    question: "Η προκαταβολή είναι υποχρεωτική στο leasing;",
    answer:
      "Οι περισσότερες συμβάσεις leasing απαιτούν μικρή προκαταβολή (συνήθως 1-3 μηνιαίες δόσεις), η οποία αναφέρεται ξεκάθαρα στην προσφορά πριν την υπογραφή.",
  },
  // Τεχνικός έλεγχος
  {
    category: "Τεχνικός έλεγχος",
    question: "Περνούν όλα τα οχήματα από τεχνικό έλεγχο πριν διατεθούν;",
    answer:
      "Ναι, κάθε όχημα ελέγχεται από εξειδικευμένους τεχνικούς σε περισσότερα από 50 σημεία (κινητήρας, ανάρτηση, φρένα, ηλεκτρονικά) πριν διατεθεί προς leasing ή πώληση.",
  },
  {
    category: "Τεχνικός έλεγχος",
    question: "Είναι το ΚΤΕΟ εν ισχύ στα οχήματα της Kinsen;",
    answer:
      "Όλα τα οχήματά μας διαθέτουν έγκυρο δελτίο ΚΤΕΟ κατά την παράδοση, σύμφωνα με την ελληνική νομοθεσία.",
  },
  {
    category: "Τεχνικός έλεγχος",
    question: "Τι γίνεται αν εντοπιστεί βλάβη μετά την παραλαβή;",
    answer:
      "Εφόσον η βλάβη καλύπτεται από την εγγύηση της Kinsen, το κόστος επισκευής καλύπτεται από εμάς. Επικοινωνήστε με το τμήμα εξυπηρέτησης για να προγραμματίσουμε τον έλεγχο.",
  },
];

async function seedAdminUser() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: "Kinsen",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log(`  Admin user ready: ${admin.email} (role: ${admin.role})`);
  return admin;
}

async function seedVehicles() {
  const createdIds: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const spec of SEED_VEHICLES) {
    const existing = await prisma.vehicle.findUnique({
      where: { externalCarId: spec.externalCarId },
      select: { id: true },
    });

    if (existing) {
      createdIds.push(existing.id);
      skipped += 1;
      continue;
    }

    const slug = await generateUniqueVehicleSlug({
      maker: spec.maker,
      model: spec.model,
      yearRelease: spec.yearRelease,
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        externalCarId: spec.externalCarId,
        slug,
        maker: spec.maker,
        model: spec.model,
        yearRelease: spec.yearRelease,
        price: spec.price,
        monthlyPrice: spec.monthlyPrice,
        km: spec.km,
        cc: spec.cc,
        hp: spec.hp,
        fuel: spec.fuel,
        transmissionType: spec.transmissionType,
        color: spec.color,
        typeOfCar: spec.typeOfCar,
        offer: spec.offer,
        froze: spec.froze,
        isDeleted: false,
        description: spec.description,
        features: spec.features,
        seoTitle: `${spec.maker} ${spec.model} ${spec.yearRelease} | Kinsen Used Cars`,
        seoDescription: spec.description,
        images: {
          create: [
            {
              url: FALLBACK_VEHICLE_IMAGE,
              alt: `${spec.maker} ${spec.model}`,
              isMain: true,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    createdIds.push(vehicle.id);
    created += 1;
  }

  console.log(`  Vehicles: ${created} created, ${skipped} already present (${SEED_VEHICLES.length} total in seed set).`);
  return createdIds;
}

async function seedFaqItems() {
  const existingCount = await prisma.faqItem.count();
  if (existingCount > 0) {
    console.log(`  FAQ items: skipped (${existingCount} already present).`);
    return;
  }

  let sortOrder = 0;
  for (const item of FAQ_ITEMS) {
    await prisma.faqItem.create({
      data: {
        question: item.question,
        answer: item.answer,
        category: item.category,
        sortOrder: sortOrder++,
        isActive: true,
      },
    });
  }

  console.log(`  FAQ items: created ${FAQ_ITEMS.length} across ${new Set(FAQ_ITEMS.map((f) => f.category)).size} categories.`);
}

async function seedSiteSettings(vehicleIds: string[]) {
  const featuredVehicleIds = vehicleIds.slice(0, 4);

  await updateSiteSetting("contactEmail", "info@kinsen.gr");
  await updateSiteSetting("contactPhone", "21 0349 7860");
  await updateSiteSetting("address", "Λεωφόρος Αθηνών 71, Τ.Κ. 104 47, Αθήνα");
  await updateSiteSetting("socialLinks", {
    facebook: "https://facebook.com/kinsenhellas",
    instagram: "https://instagram.com/kinsenhellas",
    linkedin: "https://linkedin.com/company/kinsenhellas",
  });
  await updateSiteSetting("fallbackVehicleImage", FALLBACK_VEHICLE_IMAGE);
  await updateSiteSetting("featuredVehicleIds", featuredVehicleIds);

  console.log(`  Site settings: upserted (featured vehicles: ${featuredVehicleIds.length}).`);
}

async function main() {
  console.log("Seeding Kinsen Used Cars database...\n");

  console.log("Admin user:");
  await seedAdminUser();

  console.log("\nVehicles:");
  const vehicleIds = await seedVehicles();

  console.log("\nFAQ items:");
  await seedFaqItems();

  console.log("\nSite settings:");
  await seedSiteSettings(vehicleIds);

  console.log("\nSeed complete.");
  console.log(`  Login with: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (change this password immediately after first login).`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
