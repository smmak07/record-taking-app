import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

type EntryType = 'baki' | 'joma';

type Transaction = {
  id: string;
  type: EntryType;
  item?: string;
  qty?: number;
  price?: number;
  amt: number;
  date: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  tx: Transaction[];
};

type FormKind = 'cust' | 'baki' | 'joma' | null;

const STORAGE_KEY = 'baki-v1';

const makeId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const getBalance = (customer: Customer) =>
  customer.tx.reduce(
    (total, transaction) =>
      total + (transaction.type === 'baki' ? transaction.amt : -transaction.amt),
    0,
  );

const money = (amount: number) =>
  `৳${Math.abs(amount).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`;

const transactionDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
  });

export default function LedgerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<FormKind>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored) {
          const parsed = JSON.parse(stored) as { customers?: Customer[] };
          if (!Array.isArray(parsed.customers)) {
            throw new Error('Invalid ledger data');
          }
          setCustomers(parsed.customers);
        }
        setStorageReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setStorageError('আপনার সংরক্ষিত হিসাব পড়া যায়নি। আবার চেষ্টা করুন।');
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ customers })).catch(
      () => setStorageError('হিসাব সংরক্ষণ করা যায়নি। স্টোরেজ খালি করুন।'),
    );
  }, [customers, storageReady]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const visibleCustomers = useMemo(
    () =>
      customers
        .filter(
          (customer) =>
            customer.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
            customer.phone.includes(query),
        )
        .sort((a, b) => getBalance(b) - getBalance(a)),
    [customers, query],
  );
  const outstandingTotal = customers.reduce(
    (total, customer) => total + Math.max(getBalance(customer), 0),
    0,
  );
  const owingCustomers = customers.filter(
    (customer) => getBalance(customer) > 0,
  ).length;

  const openForm = (kind: Exclude<FormKind, null>) => {
    setName('');
    setPhone('');
    setItem('');
    setQuantity('1');
    setPrice('');
    setAmount('');
    setForm(kind);
  };

  const saveForm = () => {
    if (form === 'cust') {
      const cleanName = name.trim();
      if (!cleanName) {
        Alert.alert('নাম লিখুন', 'কাস্টমারের নাম না দিলে সংরক্ষণ করা যাবে না।');
        return;
      }
      setCustomers((current) => [
        ...current,
        {
          id: makeId(),
          name: cleanName,
          phone: phone.trim(),
          tx: [],
        },
      ]);
      setForm(null);
      return;
    }

    if (!selectedCustomer) return;

    if (form === 'baki') {
      const cleanItem = item.trim();
      const parsedQuantity = Number.parseFloat(quantity);
      const parsedPrice = Number.parseFloat(price);
      if (
        !cleanItem ||
        !Number.isFinite(parsedQuantity) ||
        parsedQuantity <= 0 ||
        !Number.isFinite(parsedPrice) ||
        parsedPrice <= 0
      ) {
        Alert.alert(
          'তথ্য ঠিক করুন',
          'পণ্যের নাম, সঠিক পরিমাণ এবং একক দাম লিখুন।',
        );
        return;
      }
      const nextTransaction: Transaction = {
        id: makeId(),
        type: 'baki',
        item: cleanItem,
        qty: parsedQuantity,
        price: parsedPrice,
        amt: parsedQuantity * parsedPrice,
        date: Date.now(),
      };
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === selectedCustomer.id
            ? { ...customer, tx: [...customer.tx, nextTransaction] }
            : customer,
        ),
      );
    } else if (form === 'joma') {
      const parsedAmount = Number.parseFloat(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('টাকার পরিমাণ লিখুন', 'জমার পরিমাণ শূন্যের বেশি হতে হবে।');
        return;
      }
      const nextTransaction: Transaction = {
        id: makeId(),
        type: 'joma',
        amt: parsedAmount,
        date: Date.now(),
      };
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === selectedCustomer.id
            ? { ...customer, tx: [...customer.tx, nextTransaction] }
            : customer,
        ),
      );
    }
    setForm(null);
  };

  const removeTransaction = (transactionId: string) => {
    if (!selectedCustomer) return;
    Alert.alert('এন্ট্রি মুছবেন?', 'এই হিসাবের এন্ট্রিটি স্থায়ীভাবে মুছে যাবে।', [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'মুছুন',
        style: 'destructive',
        onPress: () =>
          setCustomers((current) =>
            current.map((customer) =>
              customer.id === selectedCustomer.id
                ? {
                    ...customer,
                    tx: customer.tx.filter(
                      (transaction) => transaction.id !== transactionId,
                    ),
                  }
                : customer,
            ),
          ),
      },
    ]);
  };

  const removeCustomer = () => {
    if (!selectedCustomer) return;
    Alert.alert(
      'কাস্টমার মুছবেন?',
      'কাস্টমার ও তার সব হিসাব স্থায়ীভাবে মুছে যাবে।',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'মুছুন',
          style: 'destructive',
          onPress: () => {
            setCustomers((current) =>
              current.filter((customer) => customer.id !== selectedCustomer.id),
            );
            setSelectedCustomerId(null);
          },
        },
      ],
    );
  };

  const sendReminder = async () => {
    if (!selectedCustomer?.phone) return;
    let digits = selectedCustomer.phone.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `88${digits}`;
    const message = `আসসালামু আলাইকুম ${selectedCustomer.name}, আপনার বাকি ${money(getBalance(selectedCustomer))}। সুবিধামতো পরিশোধ করার অনুরোধ রইল। ধন্যবাদ।`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('WhatsApp খোলা যায়নি', 'আবার চেষ্টা করুন অথবা নম্বরটি দেখুন।');
    }
  };

  const styles = makeStyles(colors);

  if (!storageReady && !storageError) {
    return (
      <View
        style={[
          styles.loading,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <MaterialCommunityIcons
          name="book-open-page-variant-outline"
          size={30}
          color={colors.primary}
        />
        <Text style={styles.loadingText}>হিসাব খুলছে…</Text>
      </View>
    );
  }

  if (storageError && !storageReady) {
    return (
      <View style={[styles.loading, { padding: 28 }]}>
        <Text style={styles.errorText}>{storageError}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            setStorageError('');
            AsyncStorage.getItem(STORAGE_KEY)
              .then((stored) => {
                const parsed = stored
                  ? (JSON.parse(stored) as { customers?: Customer[] })
                  : { customers: [] };
                if (!Array.isArray(parsed.customers)) {
                  throw new Error('Invalid ledger data');
                }
                setCustomers(parsed.customers);
                setStorageReady(true);
              })
              .catch(() =>
                setStorageError(
                  'আপনার সংরক্ষিত হিসাব পড়া যায়নি। আবার চেষ্টা করুন।',
                ),
              );
          }}
        >
          <Text style={styles.primaryButtonText}>আবার চেষ্টা করুন</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      {selectedCustomer ? (
        <ScrollView
          contentContainerStyle={[
            styles.pageContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 18 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.detailHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => setSelectedCustomerId(null)}
              accessibilityRole="button"
              accessibilityLabel="ফিরে যান"
            >
              <Feather name="arrow-left" size={21} color={colors.foreground} />
            </Pressable>
            <Text style={styles.detailHeaderTitle}>কাস্টমারের হিসাব</Text>
            <View style={styles.headerSpacer} />
          </View>
          {!!storageError && (
            <Text style={styles.warningText}>{storageError}</Text>
          )}

          <View style={styles.customerDetailCard}>
            <View style={styles.customerInitial}>
              <Text style={styles.customerInitialText}>
                {selectedCustomer.name.trim().slice(0, 1)}
              </Text>
            </View>
            <Text style={styles.detailName}>{selectedCustomer.name}</Text>
            {!!selectedCustomer.phone && (
              <Text style={styles.detailPhone}>{selectedCustomer.phone}</Text>
            )}
            <View style={styles.balanceDivider} />
            <Text style={styles.detailBalanceLabel}>
              {getBalance(selectedCustomer) > 0
                ? 'মোট বাকি'
                : getBalance(selectedCustomer) < 0
                  ? 'অগ্রিম / পরিশোধ'
                  : 'বর্তমান হিসাব'}
            </Text>
            <Text
              style={[
                styles.detailBalance,
                getBalance(selectedCustomer) > 0
                  ? styles.negativeAmount
                  : styles.positiveAmount,
              ]}
            >
              {money(getBalance(selectedCustomer))}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <ActionButton
              title="বাকি যোগ করুন"
              icon="plus"
              colors={colors}
              onPress={() => openForm('baki')}
            />
            <ActionButton
              title="জমা নিন"
              icon="download"
              colors={colors}
              secondary
              onPress={() => openForm('joma')}
            />
          </View>

          {selectedCustomer.phone && getBalance(selectedCustomer) > 0 && (
            <Pressable
              style={styles.whatsappButton}
              onPress={sendReminder}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="whatsapp"
                size={21}
                color={colors.primary}
              />
              <Text style={styles.whatsappText}>
                WhatsApp এ তাগাদা পাঠান
              </Text>
              <Feather
                name="arrow-up-right"
                size={17}
                color={colors.primary}
              />
            </Pressable>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>লেনদেনের ইতিহাস</Text>
            <Text style={styles.sectionCount}>
              {selectedCustomer.tx.length.toLocaleString('bn-BD')} এন্ট্রি
            </Text>
          </View>

          {selectedCustomer.tx.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons
                  name="receipt-text-outline"
                  size={25}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>এখনও কোনো লেনদেন নেই</Text>
              <Text style={styles.emptyDescription}>
                বাকি বা জমা যোগ করলে এখানে দেখা যাবে।
              </Text>
            </View>
          ) : (
            <View style={styles.transactionList}>
              {[...selectedCustomer.tx].reverse().map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                  <View
                    style={[
                      styles.transactionIcon,
                      transaction.type === 'baki'
                        ? styles.creditIcon
                        : styles.paymentIcon,
                    ]}
                  >
                    <Feather
                      name={
                        transaction.type === 'baki'
                          ? 'shopping-bag'
                          : 'check'
                      }
                      size={17}
                      color={
                        transaction.type === 'baki'
                          ? colors.destructive
                          : colors.primary
                      }
                    />
                  </View>
                  <View style={styles.transactionMain}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>
                      {transaction.type === 'baki'
                        ? `${transaction.item ?? 'পণ্য'}${(transaction.qty ?? 1) > 1 ? ` × ${(transaction.qty ?? 1).toLocaleString('bn-BD')}` : ''}`
                        : 'জমা'}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {transactionDate(transaction.date)}
                    </Text>
                  </View>
                  <View style={styles.transactionAmountWrap}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        transaction.type === 'baki'
                          ? styles.negativeAmount
                          : styles.positiveAmount,
                      ]}
                    >
                      {transaction.type === 'baki' ? '+' : '−'}
                      {money(transaction.amt)}
                    </Text>
                    <Pressable
                      onPress={() => removeTransaction(transaction.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="লেনদেন মুছুন"
                    >
                      <Text style={styles.deleteEntry}>মুছুন</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={styles.deleteCustomerButton}
            onPress={removeCustomer}
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={17} color={colors.destructive} />
            <Text style={styles.deleteCustomerText}>এই কাস্টমার মুছুন</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.pageContent,
              { paddingBottom: 18 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.homeHeader}>
              <View style={styles.brandIcon}>
                <MaterialCommunityIcons
                  name="book-open-page-variant"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.appTitle}>বাকি খাতা</Text>
                <Text style={styles.appSubtitle}>আপনার দোকানের হিসাব</Text>
              </View>
              <View style={styles.todayChip}>
                <Text style={styles.todayText}>
                  {new Date().toLocaleDateString('bn-BD', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.overviewCard}>
              <View style={styles.overviewTop}>
                <View>
                  <Text style={styles.overviewLabel}>মোট পাওনা</Text>
                  <Text style={styles.overviewAmount}>
                    {money(outstandingTotal)}
                  </Text>
                </View>
                <View style={styles.overviewIcon}>
                  <MaterialCommunityIcons
                    name="cash-multiple"
                    size={24}
                    color="#ffffff"
                  />
                </View>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewBottom}>
                <Text style={styles.overviewCaption}>
                  বাকি আছে এমন কাস্টমার
                </Text>
                <Text style={styles.overviewCount}>
                  {owingCustomers.toLocaleString('bn-BD')} জন
                </Text>
              </View>
            </View>

            <View style={styles.searchBox}>
              <Feather name="search" size={19} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="নাম বা ফোন দিয়ে খুঁজুন"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
                accessibilityLabel="কাস্টমার খুঁজুন"
              />
              {!!query && (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="সার্চ মুছুন"
                >
                  <Feather
                    name="x-circle"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>কাস্টমার</Text>
                <Text style={styles.sectionHint}>
                  {customers.length.toLocaleString('bn-BD')} জন মোট
                </Text>
              </View>
              {customers.length > 0 && (
                <Pressable
                  style={styles.addSmallButton}
                  onPress={() => openForm('cust')}
                  accessibilityRole="button"
                  accessibilityLabel="নতুন কাস্টমার যোগ করুন"
                >
                  <Feather name="plus" size={18} color={colors.primary} />
                </Pressable>
              )}
            </View>

            {visibleCustomers.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons
                    name={query ? 'account-search-outline' : 'account-plus-outline'}
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {query ? 'কোনো কাস্টমার পাওয়া যায়নি' : 'এখনও কাস্টমার যোগ করেননি'}
                </Text>
                <Text style={styles.emptyDescription}>
                  {query
                    ? 'অন্য নাম বা ফোন নম্বর দিয়ে খুঁজে দেখুন।'
                    : 'প্রথম কাস্টমার যোগ করে আপনার হিসাব রাখা শুরু করুন।'}
                </Text>
              </View>
            ) : (
              <View style={styles.customerList}>
                {visibleCustomers.map((customer, index) => {
                  const balance = getBalance(customer);
                  return (
                    <Pressable
                      key={customer.id}
                      style={[
                        styles.customerRow,
                        index === visibleCustomers.length - 1 &&
                          styles.customerRowLast,
                      ]}
                      onPress={() => setSelectedCustomerId(customer.id)}
                      accessibilityRole="button"
                    >
                      <View style={styles.customerAvatar}>
                        <Text style={styles.customerAvatarText}>
                          {customer.name.trim().slice(0, 1)}
                        </Text>
                      </View>
                      <View style={styles.customerCopy}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {customer.name}
                        </Text>
                        <Text style={styles.customerPhone} numberOfLines={1}>
                          {customer.phone ||
                            `${customer.tx.length.toLocaleString('bn-BD')} লেনদেন`}
                        </Text>
                      </View>
                      <View style={styles.customerBalanceWrap}>
                        <Text
                          style={[
                            styles.customerBalance,
                            balance > 0
                              ? styles.negativeAmount
                              : styles.positiveAmount,
                          ]}
                        >
                          {money(balance)}
                        </Text>
                        <Text style={styles.balanceCaption}>
                          {balance > 0 ? 'বাকি' : 'পরিশোধ'}
                        </Text>
                      </View>
                      <Feather
                        name="chevron-right"
                        size={17}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
            {!!storageError && (
              <Text style={styles.warningText}>{storageError}</Text>
            )}
          </ScrollView>
          <View
            style={[
              styles.footer,
              {
                paddingBottom:
                  Platform.OS === 'web'
                    ? Math.max(insets.bottom, 34)
                    : Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Pressable
              style={styles.primaryButton}
              onPress={() => openForm('cust')}
              accessibilityRole="button"
              testID="add-customer"
            >
              <Feather name="user-plus" size={19} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>নতুন কাস্টমার</Text>
            </Pressable>
          </View>
        </>
      )}

      <EntryModal
        form={form}
        name={name}
        phone={phone}
        item={item}
        quantity={quantity}
        price={price}
        amount={amount}
        colors={colors}
        bottomInset={insets.bottom}
        onNameChange={setName}
        onPhoneChange={setPhone}
        onItemChange={setItem}
        onQuantityChange={setQuantity}
        onPriceChange={setPrice}
        onAmountChange={setAmount}
        onClose={() => setForm(null)}
        onSave={saveForm}
      />
    </View>
  );
}

function ActionButton({
  title,
  icon,
  colors,
  secondary = false,
  onPress,
}: {
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  colors: ReturnType<typeof useColors>;
  secondary?: boolean;
  onPress: () => void;
}) {
  const styles = makeStyles(colors);
  return (
    <Pressable
      style={[styles.actionButton, secondary && styles.actionButtonSecondary]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Feather
        name={icon}
        size={18}
        color={secondary ? colors.primary : colors.primaryForeground}
      />
      <Text
        style={[
          styles.actionButtonText,
          secondary && styles.actionButtonTextSecondary,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function EntryModal({
  form,
  name,
  phone,
  item,
  quantity,
  price,
  amount,
  colors,
  bottomInset,
  onNameChange,
  onPhoneChange,
  onItemChange,
  onQuantityChange,
  onPriceChange,
  onAmountChange,
  onClose,
  onSave,
}: {
  form: FormKind;
  name: string;
  phone: string;
  item: string;
  quantity: string;
  price: string;
  amount: string;
  colors: ReturnType<typeof useColors>;
  bottomInset: number;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onItemChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const styles = makeStyles(colors);
  const title =
    form === 'cust'
      ? 'নতুন কাস্টমার'
      : form === 'baki'
        ? 'বাকি যোগ করুন'
        : 'জমা নিন';

  return (
    <Modal
      visible={form !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="ফর্ম বন্ধ করুন"
        />
        <View
          style={[
            styles.modalSheet,
            { paddingBottom: Math.max(bottomInset, 18) },
          ]}
        >
          <View style={styles.sheetHandle} />
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={styles.formContent}
            bottomOffset={24}
            keyboardDismissMode="interactive"
          >
            <View style={styles.modalHeadingRow}>
              <View style={styles.modalTitleCopy}>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalSubtitle}>
                  {form === 'cust'
                    ? 'কাস্টমারের তথ্য যোগ করুন'
                    : 'লেনদেনের তথ্য লিখুন'}
                </Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="বন্ধ করুন"
              >
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {form === 'cust' && (
              <>
                <FormField
                  label="কাস্টমারের নাম"
                  value={name}
                  onChangeText={onNameChange}
                  placeholder="নাম লিখুন"
                  colors={colors}
                  autoFocus
                  testID="customer-name"
                />
                <FormField
                  label="ফোন নম্বর"
                  value={phone}
                  onChangeText={onPhoneChange}
                  placeholder="01XXXXXXXXX"
                  keyboardType="phone-pad"
                  colors={colors}
                  testID="customer-phone"
                />
              </>
            )}

            {form === 'baki' && (
              <>
                <FormField
                  label="পণ্যের নাম"
                  value={item}
                  onChangeText={onItemChange}
                  placeholder="যেমন: চাল"
                  colors={colors}
                  autoFocus
                  testID="credit-item"
                />
                <View style={styles.formFieldsRow}>
                  <View style={styles.quantityField}>
                    <FormField
                      label="পরিমাণ"
                      value={quantity}
                      onChangeText={onQuantityChange}
                      placeholder="১"
                      keyboardType="decimal-pad"
                      colors={colors}
                      testID="credit-quantity"
                    />
                  </View>
                  <View style={styles.priceField}>
                    <FormField
                      label="একক দাম (৳)"
                      value={price}
                      onChangeText={onPriceChange}
                      placeholder="দাম লিখুন"
                      keyboardType="decimal-pad"
                      colors={colors}
                      testID="credit-price"
                    />
                  </View>
                </View>
                {!!price && Number.parseFloat(price) > 0 && (
                  <View style={styles.calculation}>
                    <Text style={styles.calculationLabel}>মোট বাকি</Text>
                    <Text style={styles.calculationAmount}>
                      {money(
                        (Number.parseFloat(quantity) || 1) *
                          Number.parseFloat(price),
                      )}
                    </Text>
                  </View>
                )}
              </>
            )}

            {form === 'joma' && (
              <FormField
                label="টাকার পরিমাণ"
                value={amount}
                onChangeText={onAmountChange}
                placeholder="৳ লিখুন"
                keyboardType="decimal-pad"
                colors={colors}
                autoFocus
                testID="payment-amount"
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>বাতিল</Text>
              </Pressable>
              <Pressable
                style={styles.saveButton}
                onPress={onSave}
                accessibilityRole="button"
                testID="save-entry"
              >
                <Feather
                  name="check"
                  size={17}
                  color={colors.primaryForeground}
                />
                <Text style={styles.primaryButtonText}>সংরক্ষণ</Text>
              </Pressable>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  colors,
  autoFocus = false,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'decimal-pad';
  colors: ReturnType<typeof useColors>;
  autoFocus?: boolean;
  testID?: string;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        testID={testID}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: colors.background },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      backgroundColor: colors.background,
    },
    loadingText: { color: colors.mutedForeground, fontSize: 15 },
    errorText: {
      color: colors.destructive,
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 18,
    },
    pageContent: { paddingHorizontal: 19, paddingTop: 14 },
    homeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 12,
    },
    brandIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    brandCopy: { flex: 1 },
    appTitle: {
      color: colors.foreground,
      fontSize: 23,
      fontWeight: '800',
      lineHeight: 31,
    },
    appSubtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 1 },
    todayChip: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    todayText: { color: colors.secondaryForeground, fontSize: 12, fontWeight: '600' },
    overviewCard: {
      borderRadius: 22,
      padding: 20,
      marginBottom: 17,
      overflow: 'hidden',
      backgroundColor: colors.darkGreen,
    },
    overviewTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    overviewLabel: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 14,
      fontWeight: '500',
    },
    overviewAmount: {
      color: '#ffffff',
      fontSize: 31,
      lineHeight: 42,
      fontWeight: '800',
      marginTop: 5,
    },
    overviewIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    overviewDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.22)',
      marginVertical: 16,
    },
    overviewBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    overviewCaption: { color: 'rgba(255,255,255,0.78)', fontSize: 13 },
    overviewCount: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    searchBox: {
      minHeight: 52,
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginBottom: 22,
    },
    searchInput: {
      flex: 1,
      color: colors.foreground,
      fontSize: 15,
      paddingVertical: 11,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 11,
    },
    sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
    sectionHint: { color: colors.mutedForeground, fontSize: 12, marginTop: 3 },
    sectionCount: { color: colors.mutedForeground, fontSize: 12 },
    addSmallButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customerList: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 19,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    customerRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 11,
    },
    customerRowLast: { borderBottomWidth: 0 },
    customerAvatar: {
      width: 45,
      height: 45,
      borderRadius: 15,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customerAvatarText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
    customerCopy: { flex: 1, minWidth: 0 },
    customerName: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
    customerPhone: { color: colors.mutedForeground, fontSize: 12, marginTop: 4 },
    customerBalanceWrap: { alignItems: 'flex-end', gap: 3 },
    customerBalance: { fontSize: 14, fontWeight: '700' },
    balanceCaption: { color: colors.mutedForeground, fontSize: 11 },
    negativeAmount: { color: colors.destructive },
    positiveAmount: { color: colors.success },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 19,
      paddingHorizontal: 24,
      paddingVertical: 27,
      marginBottom: 12,
    },
    emptyIcon: {
      width: 50,
      height: 50,
      borderRadius: 17,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptyDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 5,
    },
    footer: {
      paddingHorizontal: 19,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    primaryButton: {
      minHeight: 54,
      borderRadius: 16,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    primaryButtonText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontWeight: '700',
    },
    warningText: { color: colors.destructive, fontSize: 13, marginVertical: 12 },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      minHeight: 42,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailHeaderTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
    },
    headerSpacer: { width: 40 },
    customerDetailCard: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 21,
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 19,
    },
    customerInitial: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    customerInitialText: { color: colors.primary, fontSize: 25, fontWeight: '700' },
    detailName: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
    detailPhone: { color: colors.mutedForeground, fontSize: 13, marginTop: 4 },
    balanceDivider: {
      height: 1,
      width: '100%',
      backgroundColor: colors.border,
      marginTop: 17,
      marginBottom: 15,
    },
    detailBalanceLabel: { color: colors.mutedForeground, fontSize: 13 },
    detailBalance: { fontSize: 28, fontWeight: '800', marginTop: 5 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 13 },
    actionButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 15,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionButtonSecondary: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionButtonText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontWeight: '700',
    },
    actionButtonTextSecondary: { color: colors.primary },
    whatsappButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.accent,
      marginTop: 11,
    },
    whatsappText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    transactionList: {
      backgroundColor: colors.card,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 13,
      marginBottom: 14,
    },
    transactionRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 11,
    },
    transactionIcon: {
      width: 39,
      height: 39,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    creditIcon: { backgroundColor: `${colors.destructive}18` },
    paymentIcon: { backgroundColor: colors.accent },
    transactionMain: { flex: 1, minWidth: 0 },
    transactionTitle: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
    transactionDate: { color: colors.mutedForeground, fontSize: 12, marginTop: 5 },
    transactionAmountWrap: { alignItems: 'flex-end', gap: 4 },
    transactionAmount: { fontSize: 13, fontWeight: '700' },
    deleteEntry: { color: colors.mutedForeground, fontSize: 11 },
    deleteCustomerButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: `${colors.destructive}55`,
      borderRadius: 14,
      marginBottom: 8,
    },
    deleteCustomerText: {
      color: colors.destructive,
      fontSize: 14,
      fontWeight: '600',
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(9, 20, 13, 0.42)',
    },
    modalSheet: {
      maxHeight: '92%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 4,
      backgroundColor: colors.border,
      marginBottom: 17,
    },
    formContent: { paddingBottom: 8 },
    modalHeadingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 21,
    },
    modalTitleCopy: { flex: 1 },
    modalTitle: { color: colors.foreground, fontSize: 21, fontWeight: '800' },
    modalSubtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 4 },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    field: { marginBottom: 15 },
    fieldLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 7,
    },
    input: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.input,
      backgroundColor: colors.card,
      paddingHorizontal: 15,
      color: colors.foreground,
      fontSize: 15,
    },
    formFieldsRow: { flexDirection: 'row', gap: 11 },
    quantityField: { width: '31%' },
    priceField: { flex: 1 },
    calculation: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 15,
      marginTop: -1,
    },
    calculationLabel: { color: colors.secondaryForeground, fontSize: 13 },
    calculationAmount: { color: colors.primary, fontSize: 16, fontWeight: '800' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 7 },
    cancelButton: {
      flex: 1,
      minHeight: 51,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
    saveButton: {
      flex: 1,
      minHeight: 51,
      borderRadius: 15,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
  });
}
