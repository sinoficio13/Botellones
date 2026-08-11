import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BusinessInfo } from '@/lib/export/types';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottom: '1pt solid #e5e7eb',
  },
  logoContainer: {
    marginRight: 16,
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  textBlock: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 2,
  },
  date: {
    fontSize: 10,
    color: '#6b7280',
  },
});

type SharedHeaderProps = {
  info: BusinessInfo;
  title?: string;
};

export function SharedHeader({ info, title }: SharedHeaderProps) {
  return (
    <View style={styles.header} fixed>
      {info.logoBase64 ? (
        <View style={styles.logoContainer}>
          <Image src={info.logoBase64} style={styles.logo} />
        </View>
      ) : null}
      <View style={styles.textBlock}>
        <Text style={styles.businessName}>
          {info.businessName}
          {title ? ` — ${title}` : ''}
        </Text>
        <Text style={styles.date}>{info.date}</Text>
      </View>
    </View>
  );
}
